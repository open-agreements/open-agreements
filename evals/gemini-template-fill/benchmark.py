#!/usr/bin/env python3
"""Reproducible Gemini fill + institutional leakage benchmark (stdlib only).
No credentials are persisted. Raw provider requests/responses are append-only.
"""
import argparse, datetime as dt, difflib, fnmatch, hashlib, json, os
import pathlib, re, subprocess, tarfile, tempfile, time, urllib.request, urllib.error
import xml.etree.ElementTree as ET
import zipfile

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
MODELS = ('gemini-3.8-flash', 'gemini-4-argon')
SOURCE = '2f4dd6e072219a573b581ab5de18b43c4d8ba967'
PRICES = {
 'gemini-3.8-flash': dict(input=.75, output=3.75, cached=.075, list_input=1.5, list_output=7.5, expires='2026-12-31'),
 'gemini-4-argon': dict(input=2., output=10., cached=.10, list_input=4., list_output=20., expires='2026-11-30'),
}
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'

def dump(path, value):
 path.parent.mkdir(parents=True, exist_ok=True)
 path.write_text(json.dumps(value, indent=2, ensure_ascii=False)+'\n')
def sha(data): return hashlib.sha256(data).hexdigest()
def key():
 if os.environ.get('GEMINI_API_KEY'): return os.environ['GEMINI_API_KEY']
 return subprocess.check_output(['az','keyvault','secret','show','--vault-name','junior-internal-tools-kv','--name','oa-harvey-gemini-api-key','--query','value','-o','tsv'],text=True).strip()
def bridge(name, **args):
 p=subprocess.run(['node',str(HERE/'mcp-bridge.mjs')],input=json.dumps(dict(name=name,args=args)),text=True,capture_output=True,cwd=ROOT,check=True)
 r=json.loads(p.stdout)
 if r.get('isError'): raise RuntimeError(r)
 payload=r.get('structuredContent') or json.loads(r['content'][0]['text'])
 if not payload.get('ok'): raise RuntimeError(payload)
 return payload['data']
def docx_parts(path):
 # All Word story parts, preserving paragraph order, checkboxes, tabs and breaks.
 result={}
 with zipfile.ZipFile(path) as z:
  for name in sorted(z.namelist()):
   if re.fullmatch(r'word/(document|header\d+|footer\d+|footnotes|endnotes|comments)\.xml',name):
    root=ET.fromstring(z.read(name)); paragraphs=[]
    for p in root.iter(W+'p'):
     text=''
     for n in p.iter():
      if n.tag in (W+'t',W+'delText'): text+=n.text or ''
      elif n.tag==W+'tab': text+='\t'
      elif n.tag in (W+'br',W+'cr'): text+='\n'
      elif n.tag==W+'sym': text+='[symbol:'+str(n.attrib)+']'
      elif n.tag==W+'checked': text+='[checked:'+str(n.attrib)+']'
     paragraphs.append(text)
    result[name]=paragraphs
 return result

def cost(model, usage, list_price=False):
 p=PRICES[model]; cached=usage.get('cachedContentTokenCount',0)
 i=usage.get('promptTokenCount',0); o=usage.get('candidatesTokenCount',0)+usage.get('thoughtsTokenCount',0)
 return ((i-cached)*p['list_input' if list_price else 'input']+cached*(p['cached']*2 if list_price else p['cached'])+o*p['list_output' if list_price else 'output'])/1e6

class API:
 def __init__(self,out,budget):
  self.out=out; self.secret=key(); self.budget=budget
  self.ledger=out/'calls.jsonl'
  self.spent=sum(json.loads(l)['cost_usd'] for l in self.ledger.read_text().splitlines()) if self.ledger.exists() else 0.
 def call(self,model,request,cell):
  if dt.date.today().isoformat()>PRICES[model]['expires']: raise RuntimeError('Pricing expired; update snapshot before paid run')
  # Count first; reserve maximum possible output including thinking at full list rate.
  base='https://generativelanguage.googleapis.com/v1beta/models/'+model
  headers={'x-goog-api-key':self.secret,'Content-Type':'application/json'}
  count_payload={k:v for k,v in request.items() if k in ('contents','systemInstruction','tools')}
  count_req={'generateContentRequest':dict(model='models/'+model,**count_payload)}
  def post(url,body):
   req=urllib.request.Request(url,data=json.dumps(body).encode(),headers=headers)
   with urllib.request.urlopen(req,timeout=240) as r: return json.load(r)
  count=post(base+':countTokens',count_req)['totalTokens']
  reserve=(count*PRICES[model]['list_input']+request['generationConfig']['maxOutputTokens']*PRICES[model]['list_output'])/1e6
  if self.spent+reserve>self.budget: raise RuntimeError('Budget reservation refused')
  stamp=dt.datetime.now(dt.timezone.utc).isoformat(); start=time.monotonic()
  ordinal=len(list((self.out/'api').glob('*.request.json'))) if (self.out/'api').exists() else 0
  req_path=self.out/'api'/f'{ordinal:04d}.request.json'; dump(req_path,request)
  try: response=post(base+':generateContent',request)
  except urllib.error.HTTPError as e:
   error={'status':e.code,'body':e.read().decode()}
   error['body']=error['body'].replace(self.secret,'[REDACTED]')
   dump(self.out/'api'/f'{ordinal:04d}.error.json',error)
   raise RuntimeError(error) from None
  usage=response.get('usageMetadata')
  if not usage or 'promptTokenCount' not in usage: raise RuntimeError('Missing usage: stop, do not impute cost')
  amount=cost(model,usage); self.spent+=amount
  dump(self.out/'api'/f'{ordinal:04d}.response.json',response)
  entry=dict(cell=cell,model=model,at=stamp,request_sha256=sha(req_path.read_bytes()),response_file=f'api/{ordinal:04d}.response.json',usage=usage,cost_usd=amount,list_cost_usd=cost(model,usage,True),elapsed_seconds=time.monotonic()-start)
  with self.ledger.open('a') as f: f.write(json.dumps(entry)+'\n')
  print(f'{cell}: call {ordinal}, ${amount:.5f}, cumulative ${self.spent:.4f}',flush=True)
  return response

def prepare(out):
 fixtures=[]
 for path in sorted((HERE/'fixtures').glob('*.json')):
  f=json.loads(path.read_text()); t=bridge('get_template',template_id=f['template'])['template']
  names={x['name'] for x in t['fields']}
  assert names==set(f['expected']), (f['template'],names^set(f['expected']))
  for field in t['fields']:
   v=f['expected'][field['name']]; typ=field['type']
   assert (isinstance(v,bool) if typ=='boolean' else isinstance(v,list) if typ=='array' else isinstance(v,str))
   if typ=='enum': assert v in field['options']
  base=out/'gold'/f['template']; base.mkdir(parents=True,exist_ok=True)
  r=bridge('fill_template',template=f['template'],values=f['expected'],output_path=str(base/'gold.docx'))
  parts=docx_parts(base/'gold.docx'); dump(base/'stories.json',parts); dump(base/'metadata.json',t)
  (base/'review.txt').write_text('\n'.join(s+'\n'+'\n'.join(p) for s,p in parts.items()))
  fixtures.append(dict(template=f['template'],fixture_sha256=sha(path.read_bytes()),fields=len(names),gold_stories_sha256=sha(json.dumps(parts,sort_keys=True).encode()),warnings=r.get('warnings',[])))
 dump(out/'fixtures-manifest.json',fixtures)
 inputs={}
 for f in fixtures:
  for p in ROOT.glob('templates/*/'+f['template']+'/*'):
   if p.is_file(): inputs[str(p.relative_to(ROOT))]=sha(p.read_bytes())
 dump(out/'provenance.json',dict(repository_commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),template_files=inputs,prices=PRICES,pricing_source='https://aistudio.google.com/docs/pricing',pricing_checked='2026-11-18',generation=dict(temperature=0,thinking='provider default; usage includes thoughtsTokenCount'),backend='Gemini Developer API, existing Azure Key Vault key; standard tier'))
 return fixtures

def fill(api,repeats):
 for rep in range(1,repeats+1):
  for path in sorted((HERE/'fixtures').glob('*.json')):
   fixture=json.loads(path.read_text()); template=fixture['template']
   metadata=json.loads((api.out/'gold'/template/'metadata.json').read_text())
   for model in (MODELS if rep%2 else MODELS[::-1]):
    cell=f'fill/{model}/{template}/{rep}'; dest=api.out/cell
    if (dest/'score.json').exists(): continue
    prompt='Fill this OpenAgreements template from the deal narrative. Return only a JSON object mapping every metadata field name to its value. Include all fields, including false boolean choices and empty strings for unused alternatives. Preserve explicitly quoted wording and dates exactly as supplied; do not invent terms or add a currency symbol the template already supplies. Array fields must contain objects with the template loop variables.\n\nTEMPLATE METADATA:\n'+json.dumps(metadata)+'\n\nDEAL NARRATIVE:\n'+fixture['deal']
    request=dict(contents=[dict(role='user',parts=[dict(text=prompt)])],generationConfig=dict(temperature=0,maxOutputTokens=8192,responseMimeType='application/json'))
    response=api.call(model,request,cell); candidate=response.get('candidates',[{}])[0]
    raw=''.join(p.get('text','') for p in candidate.get('content',{}).get('parts',[]) if not p.get('thought'))
    dump(dest/'output.json',dict(text=raw,finishReason=candidate.get('finishReason')))
    expected=fixture['expected']; generated={}; error=None; rendered=False; story_diff=''
    try:
     generated=json.loads(raw)
     assert isinstance(generated,dict)
     result=bridge('fill_template',template=template,values=generated,output_path=str(dest/'generated.docx'))
     actual=docx_parts(dest/'generated.docx'); gold=json.loads((api.out/'gold'/template/'stories.json').read_text())
     dump(dest/'stories.json',actual); rendered=actual==gold
     story_diff='\n'.join(difflib.unified_diff(json.dumps(gold,indent=2).splitlines(),json.dumps(actual,indent=2).splitlines(),fromfile='gold',tofile='generated'))
    except Exception as e: error=str(e)
    if not isinstance(generated,dict): generated={}
    failures={k:dict(expected=v,actual=generated.get(k,'<MISSING>')) for k,v in expected.items() if k not in generated or type(generated[k])!=type(v) or generated[k]!=v}
    extras=sorted(set(generated)-set(expected))
    complete=candidate.get('finishReason')=='STOP'
    dump(dest/'score.json',dict(fields=len(expected),correct=len(expected)-len(failures),failures=failures,extra_fields=extras,rendered_document_exact=rendered,all_fields_exact=not failures and not extras and complete,error=error,complete=complete))
    (dest/'document.diff').write_text(story_diff+'\n')

# Closed-universe tools. No task config/rubric, arbitrary shell, or external access.
TOOL_SCHEMAS=[
 dict(name='list_files',description='List all document paths, optionally filtered by a glob.',parameters=dict(type='OBJECT',properties=dict(pattern=dict(type='STRING')))),
 dict(name='read',description='Read a UTF-8 workspace document or output. Paths start documents/ or output/.',parameters=dict(type='OBJECT',properties=dict(path=dict(type='STRING')),required=['path'])),
 dict(name='search',description='Search workspace document text with a case-insensitive literal string. Returns matching paths and lines.',parameters=dict(type='OBJECT',properties=dict(query=dict(type='STRING')),required=['query'])),
 dict(name='write',description='Write a complete Markdown deliverable under output/.',parameters=dict(type='OBJECT',properties=dict(path=dict(type='STRING'),content=dict(type='STRING')),required=['path','content'])),
]

def leakage_snapshot(source_repo,out):
 # Archive exact git objects; dirty source checkout files cannot enter an eval.
 tasks=['three-state-offer-restrictive-covenant-package']+sorted(subprocess.check_output(['git','ls-tree','--name-only',SOURCE+':tasks/openagreements'],cwd=source_repo,text=True).splitlines())
 tasks=[t for t in tasks if t=='three-state-offer-restrictive-covenant-package' or re.match(r'leakage-variant-0[1-9]-',t)]
 tasks=list(dict.fromkeys(tasks)); assert len(tasks)==10, tasks
 cache=out/'leakage-inputs'; manifest=[]
 for task in tasks:
  dest=cache/task
  if not dest.exists():
   data=subprocess.check_output(['git','archive',SOURCE,'tasks/openagreements/'+task],cwd=source_repo)
   with tempfile.TemporaryDirectory() as tmp:
    archive=pathlib.Path(tmp)/'source.tar'; archive.write_bytes(data)
    with tarfile.open(archive) as tar: tar.extractall(tmp,filter='data')
    import shutil
    shutil.copytree(pathlib.Path(tmp)/'tasks/openagreements'/task,dest)
  files={str(p.relative_to(dest)):sha(p.read_bytes()) for p in sorted(dest.rglob('*')) if p.is_file()}
  tree=subprocess.check_output(['git','rev-parse',SOURCE+':tasks/openagreements/'+task],cwd=source_repo,text=True).strip()
  manifest.append(dict(task=task,git_tree=tree,files=files))
 dump(out/'leakage-inputs-manifest.json',dict(source_repository='https://github.com/open-agreements/harvey-labs-openagreements',commit=SOURCE,tasks=manifest))
 return tasks

def leakage(api,source_repo,task_regex=None):
 for task in leakage_snapshot(source_repo,api.out):
  if task_regex and not re.search(task_regex,task): continue
  source=api.out/'leakage-inputs'/task
  config=json.loads((source/'task.json').read_text()); inputs={str(p.relative_to(source)):p.read_text() for p in sorted((source/'documents').rglob('*')) if p.is_file()}
  for model in MODELS:
   cell=f'leakage/{model}/{task}'; dest=api.out/cell
   if (dest/'status.json').exists(): continue
   dest.mkdir(parents=True,exist_ok=True); outputs={}
   system='You are an AI agent executing a legal drafting task in a workspace. Use only the provided workspace documents; do not conduct external research. documents/ is read-only. Write deliverables as Markdown under output/. Use list_files, read, search and write to complete the task. The task rubric is not accessible. When every deliverable is written, stop calling tools and provide a short completion message.'
   request=dict(systemInstruction=dict(parts=[dict(text=system)]),contents=[dict(role='user',parts=[dict(text=config['instructions'])])],tools=[dict(functionDeclarations=TOOL_SCHEMAS)],generationConfig=dict(temperature=0,maxOutputTokens=32768,thinkingConfig=dict(thinkingLevel='LOW')))
   start_spend=api.spent; finished=False; error=None
   for turn in range(80):
    if api.spent-start_spend>3.5:
     error='Per-cell cost cap'; break
    try: response=api.call(model,request,cell)
    except Exception as e: error=str(e); break
    candidate=response.get('candidates',[{}])[0]; content=candidate.get('content',dict(role='model',parts=[]))
    calls=[p['functionCall'] for p in content.get('parts',[]) if 'functionCall' in p]
    if not calls:
     finished=candidate.get('finishReason')=='STOP'; break
    request['contents'].append(content) # Preserve thought signatures verbatim.
    results=[]
    for call in calls:
     name=call['name']; args=call.get('args',{}); result=''
     try:
      if name=='list_files': result='\n'.join(p for p in inputs if fnmatch.fnmatch(p,args.get('pattern','*')))
      elif name=='search':
       q=args['query'].lower(); result='\n'.join(f'{p}:{i+1}: {line}' for p,text in inputs.items() for i,line in enumerate(text.splitlines()) if q in line.lower())[:60000]
      elif name=='read':
       p=args['path'].removeprefix('/workspace/').removeprefix('./')
       if p in inputs: result=inputs[p]
       elif p in outputs: result=outputs[p]
       else: result='ERROR: file not found; use list_files for exact paths'
      elif name=='write':
       p=args['path'].removeprefix('/workspace/').removeprefix('./'); p=p if p.startswith('output/') else 'output/'+p
       if pathlib.PurePosixPath(p).name not in config['deliverables'] or '..' in pathlib.PurePosixPath(p).parts: raise ValueError('Only requested Markdown deliverables may be written')
       outputs[p]=args['content']; (dest/pathlib.PurePosixPath(p).name).write_text(args['content']); result='Written '+p
      else: result='ERROR: unknown tool'
     except Exception as e: result='ERROR: '+str(e)
     results.append(dict(functionResponse=dict(name=name,response=dict(result=result))))
    request['contents'].append(dict(role='user',parts=results))
   expected=set(config['deliverables']); missing=sorted(expected-{pathlib.PurePosixPath(p).name for p in outputs})
   dump(dest/'status.json',dict(finished=finished,missing=missing,error=error,turns=turn+1,cost_usd=api.spent-start_spend,valid=finished and not missing and not error))


def main():
 p=argparse.ArgumentParser(); p.add_argument('command',choices=['prepare','fill','leakage']); p.add_argument('--out',type=pathlib.Path,required=True); p.add_argument('--budget',type=float,default=75); p.add_argument('--repeats',type=int,default=3); p.add_argument('--source-repo',type=pathlib.Path)
 p.add_argument('--task-regex',help='Run only matching frozen leakage instances (for independent budgeted shards)')
 a=p.parse_args(); a.out=a.out.resolve(); a.out.mkdir(parents=True,exist_ok=True)
 if a.command=='prepare': prepare(a.out)
 else:
  api=API(a.out,a.budget)
  if a.command=='fill': fill(api,a.repeats)
  else:
   if not a.source_repo: p.error('--source-repo required for leakage')
   leakage(api,a.source_repo.resolve(),a.task_regex)
if __name__=='__main__': main()

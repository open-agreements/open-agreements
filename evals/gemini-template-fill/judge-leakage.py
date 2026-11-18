#!/usr/bin/env python3
"""Two disclosed model judges for C-007; missing outputs never score clean."""
import argparse,json,pathlib
from benchmark import API,MODELS,dump,sha
p=argparse.ArgumentParser();p.add_argument('--runs',type=pathlib.Path,required=True);p.add_argument('--out',type=pathlib.Path,required=True);p.add_argument('--budget',type=float,default=3)
a=p.parse_args();a.runs=a.runs.resolve();api=API(a.out.resolve(),a.budget)
for status_path in sorted(a.runs.glob('*/leakage/*/*/status.json')):
 status=json.loads(status_path.read_text());dest=status_path.parent;model=dest.parent.name;task=dest.name
 if not status.get('valid'): continue
 config=json.loads((status_path.parents[3]/'leakage-inputs'/task/'task.json').read_text())
 criterion=next(c for c in config['criteria'] if c['id']=='C-007')
 files={f: (dest/f).read_text() for f in config['deliverables'] if f not in ('client-email.md','rationale.md')}
 assert len(files)==6
 hashes={f:sha(text.encode()) for f,text in files.items()}
 for judge in MODELS:
  cell=f'{model}/{task}/{judge}';result_path=a.out/model/task/(judge+'.json')
  if result_path.exists(): continue
  prompt='Evaluate the following six outward-facing legal drafting files against the supplied criterion. Judge placement of institutional advice, not whether the underlying legal propositions are correct. Operative contractual restrictions and legally required statutory notices are allowed. Threshold calculations, explanations of why a restriction was omitted, advice, practice-guide paths and court-enforceability analysis in a signed agreement fail. Read all six files, including notes, recitals and signature pages. Do not infer compliance from the title or from silence. Return a JSON object with fields in this order: reasoning (string), evidence (array of objects with file, quote and explanation), verdict (exactly "pass" or "fail"). Every fail must identify at least one exact verbatim quote and file. For pass, evidence may be empty.\n\nCRITERION:\n'+criterion['match_criteria']+'\n\nFILES:\n'+json.dumps(files)
  r=api.call(judge,dict(contents=[dict(role='user',parts=[dict(text=prompt)])],generationConfig=dict(temperature=0,maxOutputTokens=4096,thinkingConfig=dict(thinkingLevel='LOW'),responseMimeType='application/json')),'judge/'+cell)
  c=r['candidates'][0];text=''.join(p.get('text','') for p in c.get('content',{}).get('parts',[]) if not p.get('thought'))
  result=json.loads(text);valid=c['finishReason']=='STOP' and result.get('verdict') in ('pass','fail') and isinstance(result.get('reasoning'),str)
  if result.get('verdict')=='fail' and not result.get('evidence'): valid=False
  for e in result.get('evidence',[]):
   if e.get('file') not in files or not e.get('quote') or e['quote'] not in files[e['file']]: valid=False
  dump(result_path,dict(judge=judge,agent=model,task=task,criterion='C-007',artifact_sha256=hashes,valid=valid,result=result))

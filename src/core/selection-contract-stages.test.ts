import {it, expect} from 'vitest';
import {mkdtempSync, cpSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {compileSelectionContract, fillSelectionContract} from './selection-contract.js';
const source=resolve('templates/common-paper-cc-by-4.0/common-paper-design-partner-agreement');
it('rejects string booleans rather than silently selecting commitments', async()=>{
 const contract=await compileSelectionContract(source);
 await expect(fillSelectionContract(source,contract,{partner_case_study:'false'},'/unused.docx')).rejects.toThrow('Invalid input');
});
for(const replacements of [{'absent source text':'{free_text}'},{'[ # ]':'{unknown_field}'},{'[ # ]':'{INS process.exit()}'}]){
 it(`rejects unsupported replacement ${JSON.stringify(replacements)}`,async()=>{
  const temp=mkdtempSync(join(tmpdir(),'oa-invalid-contract-'));
  try{
   cpSync(source,temp,{recursive:true});
   writeFileSync(join(temp,'replacements.json'),JSON.stringify(replacements));
   await expect(compileSelectionContract(temp)).rejects.toThrow('Unsupported or unmatched literal replacement');
  }finally{rmSync(temp,{recursive:true,force:true});}
 });
}
it('rejects replacement drift after compilation',async()=>{
 const temp=mkdtempSync(join(tmpdir(),'oa-contract-drift-'));
 try{
  cpSync(source,temp,{recursive:true});
  const contract=await compileSelectionContract(temp);
  writeFileSync(join(temp,'replacements.json'),JSON.stringify({'[ # ]':'{open_text}','[$__________]':'{discount_amount}'}));
  await expect(fillSelectionContract(temp,contract,{},join(temp,'out.docx'))).rejects.toThrow();
 }finally{rmSync(temp,{recursive:true,force:true});}
});

// This development-only preview never joins an arcade/Ranked session.
export function readGreyboxAccess({url,topLevel=false}={}){
  let parsed;try{parsed=new URL(url);}catch{return Object.freeze({allowed:false,reason:'invalid-url',officialRun:false,rankedEligible:false});}
  const local=['127.0.0.1','localhost'].includes(parsed.hostname)&&parsed.protocol==='http:';
  const fields=[...parsed.searchParams.keys()];
  const exact=fields.length===2&&new Set(fields).size===2&&fields.every(key=>['mode','world'].includes(key))&&parsed.searchParams.get('mode')==='free'&&parsed.searchParams.get('world')==='visual-overhaul-greybox-v1';
  return Object.freeze({allowed:local&&topLevel===true&&exact,reason:!local?'local-preview-only':topLevel!==true?'top-level-only':!exact?'explicit-free-greybox-required':'local-free-navigation',officialRun:false,rankedEligible:false});
}

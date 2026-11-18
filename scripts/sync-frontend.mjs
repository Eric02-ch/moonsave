import {cp,mkdir} from 'node:fs/promises';
const target=new URL('../cloud/public/app/',import.meta.url);
await mkdir(target,{recursive:true});
await cp(new URL('../public/',import.meta.url),target,{recursive:true});
console.log('Shared frontend copied to cloud/public/app.');

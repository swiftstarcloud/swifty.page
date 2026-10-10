import {mkdir,copyFile,cp,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});
await cp('public','dist',{recursive:true});
// Keep the original repository URLs usable for hosts serving the repository root.
await copyFile('public/index.html','index.html');await mkdir('noodboi.com',{recursive:true});await copyFile('public/index.html','noodboi.com/index.html');
console.log('Static assets prepared in dist/.');

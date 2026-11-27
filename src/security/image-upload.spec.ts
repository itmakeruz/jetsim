const sharp: typeof import('sharp').default = require('sharp');
import { storeAvatar } from './image-upload';
import { promises as fs } from 'fs';
jest.mock('fs', () => ({ promises: { mkdir: jest.fn(), writeFile: jest.fn() } }));
describe('avatar upload',()=>{
 it('rejects active HTML even with image MIME',async()=>{
  await expect(storeAvatar({buffer:Buffer.from('<svg onload="evil()"/>'),size:22,mimetype:'image/png'} as any)).rejects.toMatchObject({status:400});
 });
 it('rejects oversized payload before decoding',async()=>{
  await expect(storeAvatar({buffer:Buffer.from('x'),size:6*1024*1024} as any)).rejects.toMatchObject({status:400});
 });
 it('reencodes valid images and uses server generated name',async()=>{
  const buffer=await sharp({create:{width:2,height:2,channels:3,background:'white'}}).png().toBuffer();
  const name=await storeAvatar({buffer,size:buffer.length,originalname:'attack.html'} as any);
  expect(name).toMatch(/^[a-f0-9-]+\.webp$/);
  expect(fs.writeFile).toHaveBeenCalledWith(expect.stringMatching(/\.webp$/),expect.any(Buffer),{flag:'wx'});
 });
});

import { RegionController } from '../modules/region/region.controller';
import { RegionGroupController } from '../modules/region_group/region_group.controller';
import { PartnerController } from '../modules/partner/partner.controller';
import { FaqsController } from '../modules/faqs/faqs.controller';
import 'reflect-metadata';
import { SimsService } from '../modules/sims/sims.service';
import { StaffService } from '../modules/staff/staff.service';
import { SupportController } from '../modules/support/support.controller';
import { StaffController } from '../modules/staff/staff.controller';
import { ROLES_DECORATOR_KEY } from '../common/decorators';
describe('private resources and staff privileges',()=>{
 it('scopes SIM lookup to owner and excludes provider internals',async()=>{
  const db={sims:{findFirst:jest.fn().mockResolvedValue(null)}};
  const service=new SimsService(db as any,{} as any,{} as any,{} as any,{} as any,{} as any);
  await expect(service.findOne(42,7)).rejects.toMatchObject({status:404});
  const query=db.sims.findFirst.mock.calls[0][0];
  expect(query.where).toEqual({id:42,user_id:7,reseller_order_id:null});
  expect(query.select).not.toHaveProperty('response');
  expect(query.select).not.toHaveProperty('request');
 });
 it('rejects role escalation inside service even if a controller check is bypassed',async()=>{
  const db={staff:{update:jest.fn(),create:jest.fn()}};
  const service=new StaffService(db as any);
  await expect(service.update(1,{role:'SUPER_ADMIN'} as any,{type:'staff',role:'ADMIN'})).rejects.toMatchObject({status:403});
  await expect(service.create({} as any,{type:'user',role:'SUPER_ADMIN'})).rejects.toMatchObject({status:403});
  expect(db.staff.create).not.toHaveBeenCalled();
 });
 it('does not block or demote the last active superadmin',async()=>{
  const current={id:1,name:'Admin',login:'admin',password:'hash',role:'SUPER_ADMIN',status:'ACTIVE'};
  const tx:any={staff:{findUnique:jest.fn().mockResolvedValue(current),count:jest.fn().mockResolvedValue(1),update:jest.fn(),delete:jest.fn()},$executeRaw:jest.fn()};
  const db:any={staff:{findUnique:jest.fn().mockResolvedValue(current)},$transaction:(fn:any)=>fn(tx)};
  const service=new StaffService(db),actor={type:'staff',role:'SUPER_ADMIN'};
  await expect(service.update(1,{status:'INACTIVE'} as any,actor)).rejects.toMatchObject({status:409});
  await expect(service.remove(1,actor)).rejects.toMatchObject({status:409});
  expect(tx.staff.update).not.toHaveBeenCalled();expect(tx.staff.delete).not.toHaveBeenCalled();
 });
 it('does not return password hashes in staff list',async()=>{
  const db={staff:{findMany:jest.fn().mockResolvedValue([])}};
  await new StaffService(db as any).findAll();
  expect(db.staff.findMany.mock.calls[0][0].select).not.toHaveProperty('password');
 });
 it('protects catalogue management and CMS mutations',()=>{
  for(const method of [RegionController.prototype.create, RegionController.prototype.update, RegionGroupController.prototype.createRegionGroup, RegionGroupController.prototype.updateRegionGroup, FaqsController.prototype.create]){
    expect(Reflect.getMetadata('__guards__',method)).toHaveLength(2);
    expect(Reflect.getMetadata(ROLES_DECORATOR_KEY,method)).toContain('SUPER_ADMIN');
  }
  expect(Reflect.getMetadata(ROLES_DECORATOR_KEY,PartnerController.prototype.create)).toEqual(['SUPER_ADMIN']);
 });
 it('requires superadmin on staff mutations and support CRUD',()=>{
  expect(Reflect.getMetadata(ROLES_DECORATOR_KEY,StaffController.prototype.update)).toEqual(['SUPER_ADMIN']);
  expect(Reflect.getMetadata(ROLES_DECORATOR_KEY,SupportController)).toEqual(['SUPER_ADMIN']);
 });
});

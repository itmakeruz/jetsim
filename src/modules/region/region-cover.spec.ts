import { RegionService } from './region.service';
import { RegionGroupService } from '../region_group/region_group.service';

describe.each(['region', 'group'])('Destination cover: %s', (kind) => {
  function setup() {
    const existing = {
      id: 7,
      name_ru: 'Европа',
      name_en: 'Europe',
      status: 'ACTIVE',
      image: 'flag.png',
      cover_image: 'old.webp',
    };
    const model = { findUnique: jest.fn().mockResolvedValue(existing), create: jest.fn(), update: jest.fn() };
    const prisma = {
      region: model,
      regionGroup: model,
      tariff: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    };
    const region = new RegionService(prisma as any);
    const group = new RegionGroupService(prisma as any);
    return {
      model,
      update: (data: any, cover?: string) =>
        kind === 'region'
          ? region.update(7, data, undefined, cover)
          : group.updateRegionGroup(7, data, undefined, cover),
      create: (cover?: string) =>
        kind === 'region'
          ? region.create(existing as any, 'new-flag.png', cover)
          : group.createRegionGroup(existing as any, 'new-flag.png', cover),
      detail: () => (kind === 'region' ? region.findOne(7, 'ru') : group.findRegionOneRegionGroup(7)),
    };
  }
  it('stores a new cover separately from the flag', async () => {
    const { create, model } = setup();
    await create('cover.webp');
    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ image: 'new-flag.png', cover_image: 'cover.webp' }) }),
    );
  });
  it('replaces cover without changing the flag', async () => {
    const { update, model } = setup();
    await update({}, 'new.webp');
    expect(model.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ image: 'flag.png', cover_image: 'new.webp' }) }),
    );
  });
  it('preserves the existing cover when the field is omitted', async () => {
    const { update, model } = setup();
    await update({ name_ru: 'Новое имя' });
    expect(model.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cover_image: 'old.webp' }) }),
    );
  });
  it('removes a cover only on explicit request', async () => {
    const { update, model } = setup();
    await update({ remove_cover: 'true' });
    expect(model.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cover_image: null, image: 'flag.png' }) }),
    );
  });
  it('a replacement wins over removal', async () => {
    const { update, model } = setup();
    await update({ remove_cover: 'true' }, 'replacement.webp');
    expect(model.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cover_image: 'replacement.webp' }) }),
    );
  });
  it('returns a cover URL in the detail API', async () => {
    const { detail } = setup();
    expect((await detail()).data.cover_image).toMatch(/old\.webp$/);
  });
});

import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { FaqsService } from './faqs.service';
import { CreateFaqDto, UpdateFaqDto } from './dto';
import { HeadersValidation } from '@decorators';
import { DeviceHeadersDto, ParamId } from '@enums';
import { ApiProperty } from '@nestjs/swagger';
import { UseGuards } from '@nestjs/common';
import { AtGuard, RolesGuard } from '@guards';
import { UserRoles } from '@prisma/client';
import { Roles } from '@decorators';

@Controller('faqs')
export class FaqsController {
  constructor(private readonly faqsService: FaqsService) {}

  @ApiProperty({ description: 'Get faqs Public' })
  @Get()
  async findAll(@HeadersValidation() headers: DeviceHeadersDto) {
    return this.faqsService.findAllPublic(headers?.lang);
  }

  @ApiProperty({ description: 'Get faqs Admin' })
  @Get('admin')
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN, UserRoles.ACCOUNTANT)
  async findAllAdmin() {
    return this.faqsService.findAllAdmin();
  }

  @ApiProperty({ description: 'Get one faq Public' })
  @Get(':id')
  async findOne(@Param() param: ParamId, @HeadersValidation() headers: DeviceHeadersDto) {
    return this.faqsService.findOnePublic(param.id, headers?.lang);
  }

  @ApiProperty({ description: 'Get one faq admin' })
  @Get(':id')
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN, UserRoles.ACCOUNTANT)
  async findOneAdmin(@Param() param: ParamId) {
    return this.faqsService.findOneAdmin(param.id);
  }

  @ApiProperty({ description: 'Create faq admin' })
  @Post()
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN, UserRoles.ACCOUNTANT)
  create(@Body() data: CreateFaqDto) {
    return this.faqsService.create(data);
  }

  @ApiProperty({ description: 'Update faq admin' })
  @Patch(':id')
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN, UserRoles.ACCOUNTANT)
  update(@Param('id') id: string, @Body() data: UpdateFaqDto) {
    return this.faqsService.update(+id, data);
  }

  @ApiProperty({ description: 'delete faq admin' })
  @Delete(':id')
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN, UserRoles.ACCOUNTANT)
  remove(@Param('id') id: string) {
    return this.faqsService.remove(+id);
  }
}

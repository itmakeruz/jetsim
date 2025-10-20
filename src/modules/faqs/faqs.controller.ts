import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { FaqsService } from './faqs.service';
import { CreateFaqDto, UpdateFaqDto } from './dto';
import { HeadersValidation } from '@decorators';
import { DeviceHeadersDto, ParamId } from '@enums';
import { ApiProperty } from '@nestjs/swagger';

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
  async findOneAdmin(@Param() param: ParamId) {
    return this.faqsService.findOneAdmin(param.id);
  }

  @ApiProperty({ description: 'Create faq admin' })
  @Post()
  create(@Body() data: CreateFaqDto) {
    return this.faqsService.create(data);
  }

  @ApiProperty({ description: 'Update faq admin' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateFaqDto) {
    return this.faqsService.update(+id, data);
  }

  @ApiProperty({ description: 'delete faq admin' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.faqsService.remove(+id);
  }
}

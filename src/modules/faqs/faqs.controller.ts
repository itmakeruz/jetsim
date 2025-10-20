import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { FaqsService } from './faqs.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { HeadersValidation } from '@decorators';
import { DeviceHeadersDto, ParamId } from '@enums';

@Controller('faqs')
export class FaqsController {
  constructor(private readonly faqsService: FaqsService) {}

  @Post()
  create(@Body() createFaqDto: CreateFaqDto) {
    return this.faqsService.create(createFaqDto);
  }

  @Get()
  async findAll(@HeadersValidation() headers: DeviceHeadersDto) {
    return this.faqsService.findAllPublic(headers?.lang);
  }

  @Get(':id')
  async findOne(@Param() param: ParamId, @HeadersValidation() headers: DeviceHeadersDto) {
    return this.faqsService.findOnePublic(param.id, headers?.lang);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateFaqDto: UpdateFaqDto) {
    return this.faqsService.update(+id, updateFaqDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.faqsService.remove(+id);
  }
}

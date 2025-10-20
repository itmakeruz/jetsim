import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateFaqDto, UpdateFaqDto } from './dto';
import { PrismaService } from '@prisma';
import { faq_get, faq_not_found } from '@constants';
import { Status } from '@prisma/client';

@Injectable()
export class FaqsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllPublic(lang: string) {
    const faqs = await this.prisma.faq.findMany({
      where: {
        status: Status.ACTIVE,
      },
    });
    return {
      success: true,
      message: faq_get[lang],
      data: faqs?.map((faq) => ({
        id: faq?.id,
        question: faq?.[`question_${lang}`],
        answer: faq?.[`answer_${lang}`],
        created_at: faq?.created_at,
      })),
    };
  }

  async findOnePublic(id: number, lang: string) {
    const faq = await this.prisma.faq.findUnique({
      where: {
        id: id,
        status: Status.ACTIVE,
      },
    });

    if (!faq) {
      throw new NotFoundException(faq_not_found[lang]);
    }

    return {
      success: true,
      message: faq_get[lang],
      data: {
        id: faq?.id,
        question: faq?.[`question_${lang}`],
        answer: faq?.[`answer_${lang}`],
        created_at: faq?.created_at,
      },
    };
  }

  async findAllAdmin() {
    const faqs = await this.prisma.faq.findMany();
    return {
      success: true,
      message: faq_get['ru'],
      data: faqs,
    };
  }

  async findOneAdmin(id: number) {
    const faq = await this.prisma.faq.findUnique({
      where: {
        id: id,
      },
    });

    if (!faq) {
      throw new NotFoundException(faq_not_found['ru']);
    }

    return {
      success: true,
      message: faq_get['ru'],
      data: faq,
    };
  }

  async create(createFaqDto: CreateFaqDto) {
    return 'This action adds a new faq';
  }

  update(id: number, updateFaqDto: UpdateFaqDto) {
    return `This action updates a #${id} faq`;
  }

  remove(id: number) {
    return `This action removes a #${id} faq`;
  }
}

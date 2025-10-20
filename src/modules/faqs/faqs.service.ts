import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateFaqDto, UpdateFaqDto } from './dto';
import { PrismaService } from '@prisma';
import { faq_created, faq_get, faq_not_found } from '@constants';
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

  async create(data: CreateFaqDto) {
    await this.prisma.faq.create({
      data: {
        ...data,
      },
    });

    return {
      success: true,
      message: faq_created['ru'],
      data: null,
    };
  }

  async update(id: number, data: UpdateFaqDto) {
    const faq = await this.prisma.faq.findUnique({
      where: {
        id: id,
      },
    });

    if (!faq) {
      throw new NotFoundException(faq_not_found['ru']);
    }

    await this.prisma.faq.update({
      where: {
        id: id,
      },
      data: {
        question_ru: data?.question_ru ?? faq?.question_ru,
        question_en: data?.question_en ?? faq?.question_en,
        answer_ru: data?.answer_ru ?? faq?.answer_ru,
        answer_en: data?.answer_en ?? faq?.answer_en,
        updated_at: new Date(),
      },
    });

    return {
      success: true,
      message: faq_created['ru'],
      data: null,
    };
  }

  async remove(id: number) {
    const faq = await this.prisma.faq.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
      },
    });

    if (!faq) {
      throw new NotFoundException(faq_not_found['ru']);
    }

    await this.prisma.faq.delete({
      where: {
        id: id,
      },
    });

    return {
      success: true,
      message: faq_created['ru'],
      data: null,
    };
  }
}

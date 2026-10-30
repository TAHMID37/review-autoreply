import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { CreateAutoReplyRuleDto, UpdateAutoReplyRuleDto } from "./dto/auto-reply-rule.dto";
import { translateDuplicate } from "./response-templates.service";

@Injectable()
export class AutoReplyRulesService {
  constructor(private readonly prisma: PrismaService) {}

  list(brandId: string) {
    return this.prisma.autoReplyRule.findMany({ where: { brandId }, orderBy: [{ rank: "desc" }, { name: "asc" }] });
  }

  async create(brandId: string, dto: CreateAutoReplyRuleDto) {
    await this.assertTemplatesInBrand(brandId, dto.templateIds);
    try {
      return await this.prisma.autoReplyRule.create({
        data: {
          brandId,
          name: dto.name,
          ratings: dto.ratings,
          comment: dto.comment,
          delayHours: dto.delayHours,
          templateIds: dto.templateIds,
          enabled: dto.enabled ?? true,
          rank: dto.rank ?? 0,
        },
      });
    } catch (e) {
      throw translateDuplicate(e, dto.name);
    }
  }

  async update(brandId: string, id: string, dto: UpdateAutoReplyRuleDto) {
    const rule = await this.getOrThrow(brandId, id);
    if (dto.templateIds) {
      await this.assertTemplatesInBrand(rule.brandId, dto.templateIds);
    }
    try {
      return await this.prisma.autoReplyRule.update({ where: { id }, data: dto });
    } catch (e) {
      throw translateDuplicate(e, dto.name);
    }
  }

  async remove(brandId: string, id: string) {
    await this.getOrThrow(brandId, id);
    await this.prisma.autoReplyRule.delete({ where: { id } });
    return { deleted: true };
  }

  private async getOrThrow(brandId: string, id: string) {
    const found = await this.prisma.autoReplyRule.findFirst({ where: { id, brandId } });
    if (!found) throw new NotFoundException(`Auto-reply rule ${id} not found`);
    return found;
  }

  /** A rule can only reference templates that belong to the same brand. */
  private async assertTemplatesInBrand(brandId: string, templateIds: string[]) {
    if (templateIds.length === 0) return;
    const count = await this.prisma.responseTemplate.count({
      where: { id: { in: templateIds }, brandId },
    });
    if (count !== new Set(templateIds).size) {
      throw new BadRequestException("One or more templates do not exist or belong to a different brand.");
    }
  }
}

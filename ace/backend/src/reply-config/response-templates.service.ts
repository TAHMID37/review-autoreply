import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { CreateResponseTemplateDto, UpdateResponseTemplateDto } from "./dto/response-template.dto";

@Injectable()
export class ResponseTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  list(brandId?: string) {
    return this.prisma.responseTemplate.findMany({
      where: brandId ? { brandId } : undefined,
      orderBy: [{ brandId: "asc" }, { name: "asc" }],
    });
  }

  async create(dto: CreateResponseTemplateDto) {
    try {
      return await this.prisma.responseTemplate.create({
        data: {
          brandId: dto.brandId,
          name: dto.name,
          body: dto.body,
          enabled: dto.enabled ?? true,
          createdBy: dto.createdBy ?? "Dashboard",
        },
      });
    } catch (e) {
      throw translateDuplicate(e, dto.name);
    }
  }

  async update(id: string, dto: UpdateResponseTemplateDto) {
    await this.getOrThrow(id);
    try {
      return await this.prisma.responseTemplate.update({ where: { id }, data: dto });
    } catch (e) {
      throw translateDuplicate(e, dto.name);
    }
  }

  async remove(id: string) {
    await this.getOrThrow(id);
    await this.prisma.responseTemplate.delete({ where: { id } });
    return { deleted: true };
  }

  private async getOrThrow(id: string) {
    const found = await this.prisma.responseTemplate.findUnique({ where: { id } });
    if (!found) throw new NotFoundException(`Response template ${id} not found`);
    return found;
  }
}

/** Turns Prisma's unique-constraint error into a friendly 409 for the UI. */
export function translateDuplicate(error: unknown, name?: string): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new ConflictException(`A record named "${name ?? ""}" already exists for this brand.`);
  }
  return error;
}

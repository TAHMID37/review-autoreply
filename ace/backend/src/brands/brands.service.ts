import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { APP_BRAND } from "../config/app-brand";
import { UpdateBrandDto } from "./dto/update-brand.dto";

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Single-brand deployment: only ever this app's own brand, even if the
   *  database somehow holds another one. */
  findAll() {
    return this.prisma.brand.findMany({ where: { name: APP_BRAND.name }, orderBy: { name: "asc" } });
  }

  async findById(id: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand || brand.name !== APP_BRAND.name) {
      throw new NotFoundException(`Brand ${id} not found`);
    }
    return brand;
  }

  async update(id: string, dto: UpdateBrandDto) {
    await this.findById(id);
    return this.prisma.brand.update({ where: { id }, data: dto });
  }
}

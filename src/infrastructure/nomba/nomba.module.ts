import { Module, Global } from '@nestjs/common';
import { NombaService } from './nomba.service';

@Global()
@Module({
  providers: [NombaService],
  exports: [NombaService],
})
export class NombaModule {}

import { Module, Global } from '@nestjs/common';
import { ProviderService } from './provider.service';
import { OpenAICompatProvider } from './openai-compat.provider';

@Global()
@Module({
  providers: [ProviderService, OpenAICompatProvider],
  exports: [ProviderService],
})
export class ProviderModule {}

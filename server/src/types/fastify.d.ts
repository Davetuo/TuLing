import { JwtPayload } from '../common/decorators/current-user.decorator';

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

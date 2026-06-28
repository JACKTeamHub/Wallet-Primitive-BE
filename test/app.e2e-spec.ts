import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/infrastructure/prisma/prisma.service';

describe('Users (e2e)', () => {
  let app: INestApplication;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /users', () => {
    it('should return list of users', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/users')
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });

  describe('POST /users', () => {
    it('should create a new user', async () => {
      const mockUser = {
        id: 'c827b5e8-5f21-4f38-a28a-df47cf4a4df2',
        email: 'john@example.com',
        name: 'John Doe',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);

      const res = await request(app.getHttpServer())
        .post('/users')
        .send({ email: 'john@example.com', name: 'John Doe' })
        .expect(201);

      expect(res.body).toEqual(mockUser);
    });

    it('should return 400 validation error for invalid email', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .send({ email: 'invalid-email', name: 'A' })
        .expect(400);

      expect(res.body.message).toBe('Validation failed');
      expect(res.body.errors).toBeDefined();
    });
  });
});

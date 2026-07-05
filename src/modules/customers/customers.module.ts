import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CreateCustomerUseCase } from './use-cases/create-customer.use-case';
import { FindAllCustomersUseCase } from './use-cases/find-all-customers.use-case';
import { FindOneCustomerUseCase } from './use-cases/find-one-customer.use-case';
import { RenameCustomerUseCase } from './use-cases/rename-customer.use-case';

@Module({
  controllers: [CustomersController],
  providers: [
    CreateCustomerUseCase,
    FindAllCustomersUseCase,
    FindOneCustomerUseCase,
    RenameCustomerUseCase,
  ],
  exports: [
    CreateCustomerUseCase,
    FindAllCustomersUseCase,
    FindOneCustomerUseCase,
    RenameCustomerUseCase,
  ],
})
export class CustomersModule {}

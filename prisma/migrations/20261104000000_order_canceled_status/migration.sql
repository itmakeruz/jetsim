-- Отмена заказа сотрудником в админке: новый статус заказа и его eSIM
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'CANCELED';

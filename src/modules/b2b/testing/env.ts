// Должен импортироваться ПЕРВЫМ в спеках, использующих paginate()/PrismaService из src/config:
// они читают DATABASE_URL при импорте модуля.
if (process.env.B2B_TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.B2B_TEST_DATABASE_URL;

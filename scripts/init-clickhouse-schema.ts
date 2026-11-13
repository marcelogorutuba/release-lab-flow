// The e2e suites read tables the app creates on boot; create them the same way.
import { ClickHouseService } from '../src/modules/processing/clickhouse/clickhouse.service';

new ClickHouseService().onModuleInit().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);

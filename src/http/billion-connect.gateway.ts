import { HttpService } from './http.service';

export class BillionConnect extends HttpService {
  constructor(private readonly httpService: HttpService) {
    super();
  }

  async generateAuth() {}
  async checkBalance() {}
}

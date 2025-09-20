import { Component, OnInit } from '@angular/core';
import { PlaidLinkDemoComponent } from '../../../../../angular-plaid-library/projects/plaid-link/src/lib/plaid-link-demo.component';
import { CreateUser } from '../create-user/create-user';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-test',
  imports: [PlaidLinkDemoComponent, CreateUser],
  templateUrl: './test.html',
  styleUrl: './test.scss',
})
export class Test implements OnInit {
  linkToken: string | null = null;
  user: any;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {}

  onSuccess(event: any) {
    console.log('Success event received in parent component:', event);
    this.getAccessToken(event.public_token, this.user);
  }
  onExit(event: any) {
    console.log('Exit event received in parent component:', event);
  }
  onEvent(event: any) {
    console.log('Event received in parent component:', event);
  }

  async onUserCreated(user: any) {
    this.user = user;
    console.log('User created in parent component:', user);
    await this.getLinkToken(user);
  }

  getAccessToken(public_token: string, user: any) {
    this.http
      .post('http://localhost:3000/api/plaid/exchangePublicToken', {
        publicToken: public_token,
        userId: user.Id,
      })
      .subscribe({
        next: (response: any) => {
          console.log('exchangePublicToken was successful:', response);
          // Handle success, e.g., show a success message, redirect
        },
        error: (error) => {
          console.error('Error with exchangePublicToken:', error);
          // Handle error, e.g., show an error message
        },
      });
  }

  async getLinkToken(user: any) {
    this.http.post('http://localhost:3000/api/plaid/createLinkToken', user).subscribe({
      next: (response: any) => {
        console.log('createLinkToken was successfully:', response);
        this.linkToken = response.link_token;
        // Handle success, e.g., show a success message, redirect
      },
      error: (error) => {
        console.error('Error with createLinkToken:', error);
        // Handle error, e.g., show an error message
      },
    });
  }
}

import { Component, OnInit } from '@angular/core';
import { PlaidLinkDemoComponent } from '../../../../../angular-plaid-library/projects/plaid-link/src/lib/plaid-link-demo.component';

@Component({
  selector: 'app-test',
  imports: [PlaidLinkDemoComponent],
  templateUrl: './test.html',
  styleUrl: './test.scss',
})
export class Test implements OnInit {
  constructor() {}

  ngOnInit(): void {
    //get the link token from the backend
    //pass it to the plaid-link component
  }
}

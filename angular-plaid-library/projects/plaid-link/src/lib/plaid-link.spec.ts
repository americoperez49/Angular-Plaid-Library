import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaidLink } from './plaid-link';

describe('PlaidLink', () => {
  let component: PlaidLink;
  let fixture: ComponentFixture<PlaidLink>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlaidLink]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlaidLink);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

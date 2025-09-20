import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http'; // Import HttpClient

@Component({
  selector: 'app-create-user',
  imports: [FormsModule], // Add FormsModule here
  templateUrl: './create-user.html',
  styleUrl: './create-user.scss',
})
export class CreateUser {
  newUser = {
    firstName: 'Americo',
    lastName: 'Perez',
    email: 'ap@email.com',
  };

  constructor(private http: HttpClient) {} // Inject HttpClient

  @Output() onUserCreated = new EventEmitter<any>();

  onSubmit() {
    console.log('User created:', this.newUser);
    this.http.post('http://localhost:3000/users', this.newUser).subscribe({
      next: (response: any) => {
        console.log('User created successfully:', response);
        this.onUserCreated.emit(response);
        // Handle success, e.g., show a success message, redirect
      },
      error: (error) => {
        console.error('Error creating user:', error);
        // Handle error, e.g., show an error message
      },
    });
  }
}

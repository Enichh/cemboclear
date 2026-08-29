/**
 * SignupValidator (Client Side - Single Responsibility Principle)
 * Handles strict validation for resident registration inputs before submission.
 */
const SignupValidator = {
    validate(payload) {
        const errors = [];

        // 1. First Name
        const firstName = (payload.first_name || '').trim();
        if (!firstName) {
            errors.push('First Name is required.');
        } else if (firstName.length < 2 || firstName.length > 50) {
            errors.push('First Name must be between 2 and 50 characters.');
        } else if (!/^[a-zA-Z\s\-\'\.]+$/.test(firstName)) {
            errors.push('First Name contains invalid characters.');
        }

        // 2. Last Name
        const lastName = (payload.last_name || '').trim();
        if (!lastName) {
            errors.push('Last Name is required.');
        } else if (lastName.length < 2 || lastName.length > 50) {
            errors.push('Last Name must be between 2 and 50 characters.');
        } else if (!/^[a-zA-Z\s\-\'\.]+$/.test(lastName)) {
            errors.push('Last Name contains invalid characters.');
        }

        // 3. Middle Name (optional)
        if (payload.middle_name) {
            const middleName = payload.middle_name.trim();
            if (middleName.length > 50) {
                errors.push('Middle Name must not exceed 50 characters.');
            } else if (!/^[a-zA-Z\s\-\'\.]+$/.test(middleName)) {
                errors.push('Middle Name contains invalid characters.');
            }
        }

        // 4. Email
        const email = (payload.email || '').trim();
        if (!email) {
            errors.push('Email address is required.');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push('Please enter a valid email address.');
        }

        // 5. Phone
        const phone = (payload.phone || '').trim();
        if (!phone) {
            errors.push('Phone number is required.');
        } else {
            const digits = phone.replace(/\D/g, '');
            if (digits.length < 10 || digits.length > 13) {
                errors.push('Please enter a valid Philippine mobile phone number.');
            }
        }

        // 6. Birthdate
        const birthdate = (payload.birthdate || '').trim();
        if (!birthdate) {
            errors.push('Birthdate is required.');
        } else {
            const dateObj = new Date(birthdate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (isNaN(dateObj.getTime())) {
                errors.push('Birthdate must be a valid date.');
            } else if (dateObj > today) {
                errors.push('Birthdate cannot be in the future.');
            }
        }

        // 7. Gender
        const gender = (payload.gender || '').trim().toLowerCase();
        if (!gender) {
            errors.push('Gender is required.');
        } else if (!['male', 'female', 'other'].includes(gender)) {
            errors.push('Please select a valid gender option.');
        }

        // 8. Password
        const password = payload.password || '';
        if (!password) {
            errors.push('Password is required.');
        } else {
            if (password.length < 8) {
                errors.push('Password must be at least 8 characters long.');
            }
            if (!/[A-Z]/.test(password)) {
                errors.push('Password must contain at least one uppercase letter.');
            }
            if (!/[a-z]/.test(password)) {
                errors.push('Password must contain at least one lowercase letter.');
            }
            if (!/[0-9]/.test(password)) {
                errors.push('Password must contain at least one number.');
            }
            if (!/[\W_]/.test(password)) {
                errors.push('Password must contain at least one special character.');
            }
        }

        // 9. Confirm Password
        if (payload.password_confirm !== undefined) {
            if (payload.password_confirm !== password) {
                errors.push('Passwords do not match.');
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SignupValidator;
}

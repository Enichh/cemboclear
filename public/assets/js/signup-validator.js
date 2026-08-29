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

        // 3. Middle Name (optional) — a single middle initial, e.g. "M" or "M."
        if (payload.middle_name && payload.middle_name.trim() !== '') {
            const middleName = payload.middle_name.trim();
            if (!/^[a-zA-Z]\.?$/.test(middleName)) {
                errors.push('Middle initial must be a single letter (e.g. M or M.).');
            }
        }

        // 4. Email
        const email = (payload.email || '').trim().toLowerCase();
        if (!email) {
            errors.push('Email address is required.');
        } else if (email.length > 255) {
            errors.push('Email address must not exceed 255 characters.');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push('Please enter a valid email address.');
        }

        // 5. Phone — STRICT Philippine mobile validation, mirroring the backend
        //    PhoneNormalizer::extractBase() so frontend and backend agree.
        const phone = (payload.phone || '').trim();
        if (!phone) {
            errors.push('Phone number is required.');
        } else if (phMobileBase(phone) === null) {
            errors.push('Please enter a valid Philippine mobile number (e.g. 0917 123 4567 or +63 917 123 4567).');
        }

        // 6. Birthdate — strict YYYY-MM-DD, must be a real past date.
        const birthdate = (payload.birthdate || '').trim();
        if (!birthdate) {
            errors.push('Birthdate is required.');
        } else if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
            errors.push('Birthdate must be in YYYY-MM-DD format.');
        } else {
            const parts = birthdate.split('-').map(Number);
            const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
            const isRealDate = dateObj.getFullYear() === parts[0] &&
                dateObj.getMonth() === parts[1] - 1 &&
                dateObj.getDate() === parts[2];
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (!isRealDate) {
                errors.push('Birthdate must be a valid date.');
            } else if (dateObj > today) {
                errors.push('Birthdate cannot be in the future.');
            } else if (parts[0] < 1900) {
                errors.push('Birthdate looks unreasonably old (must be on or after 1900).');
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
        } else if (new TextEncoder().encode(password).length > 72) {
            // Mirrors the backend: PHP's bcrypt (PASSWORD_DEFAULT) truncates at
            // 72 bytes, so silently accepting longer passwords would make distinct
            // passwords hash identically.
            errors.push('Password must not exceed 72 characters.');
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

/**
 * Extract the canonical 10-digit base of a Philippine mobile number, or null
 * if the string cannot be normalized. Mirrors the backend PhoneNormalizer::
 * extractBase() so frontend and backend validation agree exactly.
 *
 * Accepts: +639171234567, 09171234567, 639171234567, 9171234567, 0917-123-4567.
 */
function phMobileBase(phone) {
    const digits = String(phone).replace(/\D/g, '');
    if (!digits) return null;

    if (digits.indexOf('639') === 0 && digits.length === 12) {
        return digits.slice(2);
    }
    if (digits.indexOf('09') === 0 && digits.length === 11) {
        return digits.slice(1);
    }
    if (digits.indexOf('9') === 0 && digits.length === 10) {
        return digits;
    }
    return null;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SignupValidator;
}

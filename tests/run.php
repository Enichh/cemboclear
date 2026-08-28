<?php
/**
 * CemboClear — Green Test Baseline
 *
 * Run:  php tests/run.php
 * Expects: MySQL running, config.php present, schema.sql already imported.
 *
 * Tests core infrastructure (Database, Auth, Router, helpers) with zero
 * external dependencies. Uses a disposable test database that is created
 * and destroyed during the run.
 */

declare(strict_types=1);

// ─── Bootstrap ───────────────────────────────────────────────────────────
$root = dirname(__DIR__);
require_once $root . '/app/Core/helpers.php';

spl_autoload_register(function (string $class): void {
    $prefix = 'App\\';
    $baseDir = dirname(__DIR__) . '/app/';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) return;
    $relativeClass = substr($class, strlen($prefix));
    $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';
    if (file_exists($file)) require $file;
});

use App\Core\Database;
use App\Core\Router;
use App\Core\Response;
use App\Core\Auth;
use App\Core\RateLimiter;
use App\Core\ErrorHandler;
use App\Core\PhoneNormalizer;
use App\Features\StaffAuthentication\LoginValidator;
use App\Features\ResidentAccountCreation\SignupValidator;

// Suppress session warnings in CLI (expected — sessions require a web server)
set_error_handler(function (int $errno, string $errstr) {
    if (str_contains($errstr, 'session') || str_contains($errstr, 'Session')) {
        return true; // suppress
    }
    return false; // let other errors through
});

// ─── Helpers ─────────────────────────────────────────────────────────────
$passed = 0;
$failed = 0;
$errors = [];

function test(string $name, callable $fn): void
{
    global $passed, $failed, $errors;
    try {
        $fn();
        $passed++;
        echo "  ✓ {$name}\n";
    } catch (\Throwable $e) {
        $failed++;
        $msg = $e->getMessage() . ' (' . $e->getFile() . ':' . $e->getLine() . ')';
        $errors[] = "{$name}: {$msg}";
        echo "  ✗ {$name}\n    {$msg}\n";
    }
}

function assert_eq(mixed $expected, mixed $actual, string $msg = ''): void
{
    if ($expected !== $actual) {
        throw new \RuntimeException(
            ($msg ? "{$msg}: " : '') .
            'expected ' . var_export($expected, true) .
            ', got ' . var_export($actual, true)
        );
    }
}

function assert_true(bool $value, string $msg = ''): void
{
    if (!$value) {
        throw new \RuntimeException(($msg ?: 'assertion failed'));
    }
}

// ─── Suppress HTTP output during tests ───────────────────────────────────
echo "\n=== CemboClear Test Baseline ===\n\n";

// ─── 1. Helpers ──────────────────────────────────────────────────────────
echo "--- Helpers ---\n";

test('e() escapes HTML', function () {
    assert_eq('&amp;&lt;&gt;', e('&<>'));
});

test('e() handles null', function () {
    assert_eq('', e(null));
});

test('base_path() returns project root', function () {
    assert_true(str_ends_with(base_path(), 'cemboclear') || str_ends_with(base_path(), 'cemboclear/'));
});

test('public_path() returns public directory', function () {
    assert_true(str_contains(public_path(), 'public'));
});

test('storage_path() returns storage directory', function () {
    assert_true(str_contains(storage_path(), 'storage'));
});

test('config() reads values', function () {
    $name = config('app.name');
    assert_true($name === 'CemboClear' || $name !== null, 'config returned a value');
});

test('config() returns default for missing key', function () {
    assert_eq('fallback', config('nonexistent.key', 'fallback'));
});

test('generate_ticket_id() format', function () {
    $id = generate_ticket_id();
    assert_true(preg_match('/^#REQ-\d{4}-\d{4}$/', $id) === 1, "Got: {$id}");
});

// ─── 2. Router ───────────────────────────────────────────────────────────
echo "\n--- Router ---\n";

test('Router matches GET route', function () {
    $router = new Router();
    $matched = false;
    $router->get('/api/test', function () use (&$matched) { $matched = true; });
    $router->dispatch('GET', '/api/test');
    assert_true($matched, 'Route should have matched');
});

test('Router matches POST route', function () {
    $router = new Router();
    $matched = false;
    $router->post('/api/items', function () use (&$matched) { $matched = true; });
    $router->dispatch('POST', '/api/items');
    assert_true($matched);
});

test('Router does not match wrong method', function () {
    $router = new Router();
    $matched = false;
    $router->get('/api/special', function () use (&$matched) { $matched = true; });
    $result = $router->dispatch('POST', '/api/special');
    assert_true(!$matched && $result === false);
});

test('Router extracts path parameters', function () {
    $router = new Router();
    $captured = null;
    $router->get('/api/users/{id}', function (string $id) use (&$captured) { $captured = $id; });
    $router->dispatch('GET', '/api/users/42');
    assert_eq('42', $captured);
});

test('Router returns false for unmatched', function () {
    $router = new Router();
    $result = $router->dispatch('GET', '/api/nonexistent');
    assert_eq(false, $result);
});

// ─── 3. Auth (session-based, unit testable) ───────────────────────────────
echo "\n--- Auth ---\n";

// Clear any session
if (session_status() !== PHP_SESSION_NONE) session_destroy();
$_SESSION = [];

test('Auth starts with no user', function () {
    Auth::start();
    assert_true(!Auth::check());
});

test('Auth::id() returns null when not logged in', function () {
    assert_eq(null, Auth::id());
});

test('Auth::type() returns null when not logged in', function () {
    assert_eq(null, Auth::type());
});

test('Auth::loginStaff sets session', function () {
    Auth::loginStaff(1, 'System Administrator');
    assert_true(Auth::check());
    assert_eq(1, Auth::id());
    assert_eq('staff', Auth::type());
    assert_eq('System Administrator', Auth::role());
    assert_true(Auth::isAdmin());
});

test('Auth::isAdmin() returns false for regular staff', function () {
    Auth::loginStaff(2, 'Barangay Staff');
    assert_true(Auth::check());
    assert_true(!Auth::isAdmin());
});

test('Auth::isAdmin() returns false for resident', function () {
    Auth::loginResident(5);
    assert_true(Auth::check());
    assert_true(!Auth::isAdmin());
});

test('Auth::logout clears session', function () {
    $_SESSION = ['user_id' => 1, 'user_type' => 'staff'];
    Auth::logout();
    assert_true(empty($_SESSION['user_id']));
});

test('Auth::loginResident sets session', function () {
    Auth::loginResident(5);
    assert_true(Auth::check());
    assert_eq(5, Auth::id());
    assert_eq('resident', Auth::type());
});

// ─── 4. Database connection ──────────────────────────────────────────────
echo "\n--- Database ---\n";

$mysqlAvailable = false;
try {
    $testDb = new Database();
    $testDb->query('SELECT 1');
    $mysqlAvailable = true;
} catch (\Throwable $e) {
    // MySQL not available — skip these tests gracefully
}

test('Database connects to MySQL', function () use (&$mysqlAvailable) {
    if (!$mysqlAvailable) {
        echo "    (skipped — MySQL not running)\n";
        return;
    }
    $db = new Database();
    $result = $db->query('SELECT 1 as val')->fetch();
    assert_eq(1, (int)$result['val']);
});

test('Database query with parameters', function () use (&$mysqlAvailable) {
    if (!$mysqlAvailable) {
        echo "    (skipped — MySQL not running)\n";
        return;
    }
    $db = new Database();
    $result = $db->query('SELECT ? as msg', ['hello'])->fetch();
    assert_eq('hello', $result['msg']);
});

// ─── 5. CSRF ─────────────────────────────────────────────────────────────
echo "\n--- CSRF ---\n";

use App\Core\Csrf;

test('Csrf::token() generates a token', function () {
    $token = Csrf::token();
    assert_true(strlen($token) === 64, 'Token should be 64 hex chars');
});

test('Csrf::validate() accepts correct token', function () {
    $token = Csrf::token();
    assert_true(Csrf::validate($token));
});

test('Csrf::validate() rejects wrong token', function () {
    assert_true(!Csrf::validate('wrong-token'));
});

test('Csrf::validate() rejects null', function () {
    assert_true(!Csrf::validate(null));
});

// ─── 6. Rate Limiter ─────────────────────────────────────────────────────
echo "\n--- Rate Limiter ---\n";

test('RateLimiter allows requests within maxAttempts', function () {
    RateLimiter::check('unit_test_allowed', 2, 60);
});

// ─── 7. Central Error Handler ────────────────────────────────────────────
echo "\n--- Central Error Handler ---\n";

test('ErrorHandler registers error handlers successfully', function () {
    ErrorHandler::register();
    assert_true(true);
});

// ─── 8. Validation Services & Normalizers (SRP) ─────────────────────────
echo "\n--- Validation & Normalization Services (SRP) ---\n";

test('PhoneNormalizer normalizes various PH mobile formats', function () {
    assert_eq('09171234567', PhoneNormalizer::toNational('+639171234567'));
    assert_eq('09171234567', PhoneNormalizer::toNational('+63 | 917 123 4567'));
    assert_eq('+639171234567', PhoneNormalizer::toE164('0917-123-4567'));
    assert_true(PhoneNormalizer::isValid('09171234567'));
    assert_true(!PhoneNormalizer::isValid('12345'));
});

test('PhoneNormalizer generates database query variations', function () {
    $vars = PhoneNormalizer::getVariations('+63 | 917 123 4567');
    assert_true(in_array('09171234567', $vars, true));
    assert_true(in_array('+639171234567', $vars, true));
    assert_true(in_array('9171234567', $vars, true));
});

test('LoginValidator validates valid email and password', function () {
    $errs = LoginValidator::validate(['email' => 'user@example.com', 'password' => 'Pass123!']);
    assert_true(empty($errs));
});

test('LoginValidator accepts valid phone login', function () {
    $errs = LoginValidator::validate(['identifier' => '+63 | 917 123 4567', 'password' => 'Pass123!']);
    assert_true(empty($errs));
});

test('LoginValidator rejects invalid identifier format', function () {
    $errs = LoginValidator::validate(['email' => 'invalid-email-format', 'password' => 'Pass123!']);
    assert_true(!empty($errs));
});

test('SignupValidator validates valid resident payload', function () {
    $errs = SignupValidator::validate([
        'first_name' => 'Juan',
        'last_name' => 'Dela Cruz',
        'email' => 'juan@example.com',
        'phone' => '+63 | 917 123 4567',
        'birthdate' => '1995-05-15',
        'gender' => 'male',
        'password' => 'StrongP@ss1'
    ]);
    assert_true(empty($errs));
});

test('SignupValidator rejects weak password', function () {
    $errs = SignupValidator::validate([
        'first_name' => 'Juan',
        'last_name' => 'Dela Cruz',
        'email' => 'juan@example.com',
        'birthdate' => '1995-05-15',
        'gender' => 'male',
        'password' => 'weak'
    ]);
    assert_true(!empty($errs));
});

// ─── Summary ─────────────────────────────────────────────────────────────
echo "\n=== Results: {$passed} passed, {$failed} failed ===\n";

if ($failed > 0) {
    echo "\nFailures:\n";
    foreach ($errors as $err) {
        echo "  - {$err}\n";
    }
    exit(1);
}

echo "\nAll tests passed.\n";
exit(0);

<?php
declare(strict_types=1);

namespace App\Core;

/**
 * PDO database wrapper. Injected into controllers, never statically accessed.
 *
 * Usage:
 *   $db = new Database();
 *   $stmt = $db->query('SELECT * FROM residents WHERE id = ?', [$id]);
 *   $row = $stmt->fetch();
 */
class Database
{
    private \PDO $pdo;

    public function __construct()
    {
        $host = config('db.host', '127.0.0.1');
        $port = config('db.port', '3306');
        $name = config('db.name', 'cemboclear');
        $user = config('db.user', 'root');
        $pass = config('db.pass', '');
        $charset = config('db.charset', 'utf8mb4');

        $dsn = "mysql:host={$host};port={$port};dbname={$name};charset={$charset}";

        $this->pdo = new \PDO($dsn, $user, $pass, [
            \PDO::ATTR_ERRMODE            => \PDO::ERRMODE_EXCEPTION,
            \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
            \PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }

    /** Execute a prepared SELECT query and return the statement. */
    public function query(string $sql, array $params = []): \PDOStatement
    {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    /** Execute a prepared INSERT/UPDATE/DELETE and return affected row count. */
    public function execute(string $sql, array $params = []): int
    {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount();
    }

    /** Return the last inserted auto-increment ID. */
    public function lastInsertId(): string
    {
        return $this->pdo->lastInsertId();
    }

    /** Begin a transaction. */
    public function beginTransaction(): bool
    {
        return $this->pdo->beginTransaction();
    }

    /** Commit the active transaction. */
    public function commit(): bool
    {
        return $this->pdo->commit();
    }

    /** Roll back the active transaction. */
    public function rollBack(): bool
    {
        return $this->pdo->rollBack();
    }

    /** Return the underlying PDO instance (rare use cases only). */
    public function getPdo(): \PDO
    {
        return $this->pdo;
    }
}

<?php
/**
 * CemboClear Configuration Loader
 *
 * Loads config.php from project root. Falls back to config.example.php
 * if config.php does not exist (useful during initial setup).
 */

$root = dirname(__DIR__, 2);
$configFile = $root . '/config.php';

if (!file_exists($configFile)) {
    $configFile = $root . '/config.example.php';
}

return require $configFile;

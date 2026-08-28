<?php
declare(strict_types=1);

namespace App\Features\FileUploads;

use App\Core\Database;
use App\Core\Response;
use App\Core\Auth;

class FileUploadsController
{
    private Database $db;

    public function __construct()
    {
        $this->db = new Database();
    }

    /** POST /api/upload — Upload a file (signature, valid_id, or supporting_document) */
    public function upload(): void
    {
        Auth::requireRole();

        if (empty($_FILES['file'])) {
            Response::error('No file uploaded.', 422);
        }

        $file = $_FILES['file'];
        $kind = $_POST['kind'] ?? 'supporting_document';
        $requestId = !empty($_POST['request_id']) ? (int)$_POST['request_id'] : null;
        $residentId = !empty($_POST['resident_id']) ? (int)$_POST['resident_id'] : null;

        if ($requestId === null && $residentId === null && Auth::type() === 'resident') {
            $residentId = Auth::id();
        }

        if ($requestId === null && $residentId === null) {
            Response::error('Either request_id or resident_id must be provided.', 422);
        }

        $validKinds = ['signature', 'valid_id', 'supporting_document'];
        if (!in_array($kind, $validKinds, true)) {
            Response::error('Invalid attachment kind.', 422);
        }

        // Validate file size
        $maxSize = config('upload.max_size', 5 * 1024 * 1024);
        if ($file['size'] > $maxSize) {
            Response::error('File too large. Max: 5MB.', 422);
        }

        $allowedTypes = config('upload.allowed_types', ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mimeType = $finfo->file($file['tmp_name']);
        if (!in_array($mimeType, $allowedTypes, true)) {
            Response::error('File type not allowed: ' . $mimeType, 422);
        }

        // Sanitize client-supplied file name to remove illegal path/header characters
        $rawOriginalName = basename((string)$file['name']);
        $safeOriginalName = preg_replace('/[^\w\.\-]/', '_', $rawOriginalName);
        if ($safeOriginalName === '') {
            $safeOriginalName = 'upload';
        }

        // Determine extension safely
        $extMap = [
            'image/jpeg' => 'jpg',
            'image/png'  => 'png',
            'image/webp' => 'webp',
            'application/pdf' => 'pdf',
        ];
        $safeExt = $extMap[$mimeType] ?? 'bin';

        $safeName = bin2hex(random_bytes(16)) . '.' . $safeExt;
        $uploadDir = storage_path('uploads');

        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $dest = $uploadDir . '/' . $safeName;
        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            Response::error('Failed to save file.', 500);
        }

        // Insert record
        $this->db->execute(
            'INSERT INTO attachments (request_id, resident_id, kind, file_name, file_path)
             VALUES (?, ?, ?, ?, ?)',
            [$requestId, $residentId, $kind, $safeOriginalName, $safeName]
        );

        Response::json([
            'message'   => 'File uploaded',
            'id'        => (int)$this->db->lastInsertId(),
            'file_name' => $safeOriginalName,
            'kind'      => $kind,
        ], 201);
    }
}

<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// Replace this sample payload with a server-side FossBilling API response.
$plans = [
    [
        'id' => 'personal',
        'name' => 'Personal',
        'storage' => '100 GB',
        'users' => 1,
        'monthly_price' => 29000,
        'annual_price' => 290000,
        'description' => 'Ruang aman untuk semua hal pentingmu.',
        'features' => [
            'Penyimpanan cloud privat',
            'Dokumen dan catatan',
            'Sinkronisasi lintas perangkat',
            'Berbagi file dengan aman',
        ],
        'translations' => [
            'en' => [
                'name' => 'Personal',
                'description' => 'A safe space for everything that matters.',
                'features' => [
                    'Private cloud storage',
                    'Documents and notes',
                    'Sync across devices',
                    'Secure file sharing',
                ],
            ],
        ],
        'featured' => false,
    ],
    [
        'id' => 'plus',
        'name' => 'Plus',
        'storage' => '1 TB',
        'users' => 1,
        'monthly_price' => 59000,
        'annual_price' => 590000,
        'description' => 'Lebih banyak ruang, tetap simpel.',
        'features' => [
            'Semua fitur Personal',
            'Penyimpanan 1 TB',
            'Kolaborasi real-time',
            'Riwayat versi file',
        ],
        'translations' => [
            'en' => [
                'name' => 'Plus',
                'description' => 'More room, without the extra fuss.',
                'features' => [
                    'Everything in Personal',
                    '1 TB of storage',
                    'Real-time collaboration',
                    'File version history',
                ],
            ],
        ],
        'featured' => true,
    ],
    [
        'id' => 'family',
        'name' => 'Keluarga',
        'storage' => '2 TB',
        'users' => 5,
        'monthly_price' => 99000,
        'annual_price' => 990000,
        'description' => 'Satu cloud privat untuk seisi rumah.',
        'features' => [
            'Semua fitur Plus',
            'Hingga 5 anggota keluarga',
            'Ruang bersama dan privat',
            'Berbagi kalender dan tugas',
        ],
        'translations' => [
            'en' => [
                'name' => 'Family',
                'description' => 'One private cloud for everyone at home.',
                'features' => [
                    'Everything in Plus',
                    'Up to 5 family members',
                    'Shared and private spaces',
                    'Shared calendars and tasks',
                ],
            ],
        ],
        'featured' => false,
    ],
];

echo json_encode(
    [
        'source' => 'placeholder',
        'currency' => 'IDR',
        'plans' => $plans,
    ],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
);

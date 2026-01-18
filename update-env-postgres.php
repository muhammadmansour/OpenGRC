<?php
$env = file_get_contents('.env');

$env = preg_replace('/DB_CONNECTION=.*/m', 'DB_CONNECTION=pgsql', $env);
$env = preg_replace('/DB_HOST=.*/m', 'DB_HOST=35.209.202.143', $env);
$env = preg_replace('/DB_PORT=.*/m', 'DB_PORT=5432', $env);
$env = preg_replace('/DB_DATABASE=.*/m', 'DB_DATABASE=opengrc', $env);

file_put_contents('.env', $env);
echo "Updated .env to use PostgreSQL at 35.209.202.143\n";

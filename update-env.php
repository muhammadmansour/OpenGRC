<?php
$env = file_get_contents('.env');

$env = preg_replace('/DB_CONNECTION=.*/m', 'DB_CONNECTION=mysql', $env);
$env = preg_replace('/DB_HOST=.*/m', 'DB_HOST=127.0.0.1', $env);
$env = preg_replace('/DB_PORT=.*/m', 'DB_PORT=3306', $env);
$env = preg_replace('/DB_DATABASE=.*/m', 'DB_DATABASE=opengrc', $env);
$env = preg_replace('/DB_USERNAME=.*/m', 'DB_USERNAME=root', $env);
$env = preg_replace('/DB_PASSWORD=.*/m', 'DB_PASSWORD=', $env);

file_put_contents('.env', $env);
echo "Updated .env to use MySQL\n";

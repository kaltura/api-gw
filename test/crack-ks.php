<?php

$ks = 'djJ8MjAzfKZvm_jZ2m7O3o1LcakOKvmtEpVs0gm_t4ASBiNg1VDnOM6-pG2Q5bL46NBcNqUVL3bd3BDP44ucv3UAJrm06vHW79ISifBX_qAtm3bq0PJyzgQNGFf-rzCImkFBS6YGaKTiQtNxUyZ7sT_92ZVwxGc=';
$ks = 'djJ8MjAzfLAYC6sJTKM_NyvDzwdwcA9k5hhPcqaL6P93CoOmFHeSo7XGsvo9FQJmTKGoASHuApunxUrHF7fc1TXYovcfT9zcC52UE6vwAyqUeA2Ov5aEuHd1Xf5aH63sGKHkFcRJwd4cRAjvtM4z99QJBCoR4X4==';
$adminSecret = '12345';



const SHA1_SIZE = 20;
const RANDOM_SIZE = 16;
const AES_IV = "\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0";	// no need for an IV since we add a random string to the message anyway

const FIELD_EXPIRY =              '_e';
const FIELD_TYPE =                '_t';
const FIELD_USER =                '_u';
const FIELD_MASTER_PARTNER_ID =   '_m';
const FIELD_ADDITIONAL_DATA =     '_d';

$fieldMapping = array(
    FIELD_EXPIRY => 'valid_until',
    FIELD_TYPE => 'type',
    FIELD_USER => 'user',
    FIELD_MASTER_PARTNER_ID => 'master_partner_id',
    FIELD_ADDITIONAL_DATA => 'additional_data',
);


const AES_BLOCK_SIZE = 16;
const DES3_BLOCK_SIZE = 8;
const AES_METHOD = 'AES-128-CBC';
const DES3_METHOD = 'DES-EDE3';

function aesDecrypt($key, $message)
{
    $key = substr(sha1($key, true), 0, 16);
    
    return openssl_decrypt(
        $message,
        AES_METHOD,
        $key,
        OPENSSL_RAW_DATA | OPENSSL_ZERO_PADDING,
        AES_IV
    );

    
    // return mcrypt_decrypt(
    //     MCRYPT_RIJNDAEL_128,
    //     $key,
    //     $str,
    //     MCRYPT_MODE_CBC,
    //     AES_IV	
    // );
}

$base64 = str_replace(array('-', '_'), array('+', '/'), $ks);
$decodedKs = base64_decode($base64, false);
$explodedKs = explode('|', $decodedKs , 3);

list($version, $partnerId, $encKs) = $explodedKs;

$decKs = aesDecrypt($adminSecret, $encKs);

$hash = substr($decKs, 0, SHA1_SIZE);
$fields = substr($decKs, SHA1_SIZE);
$trimmedFields = hex2bin(preg_replace('/(0{2})+$/', '', bin2hex($fields)));
// var_dump(bin2hex($fields));
// var_dump(bin2hex($trimmedFields));
// var_dump(bin2hex($hash));
// var_dump(bin2hex(sha1($trimmedFields, true))); 
// var_dump(bin2hex(sha1($fields, true))); 
// exit;

if ($hash !== sha1($fields, true) && $hash !== sha1($trimmedFields, true))
{
    throw new Exception("Hash [" . bin2hex($hash) . " != " . bin2hex(sha1($fields, true)) . "] doesn't match sha1 on partner [$partnerId].");
}

$rand = substr($fields, 0, RANDOM_SIZE);
$fields = substr($fields, RANDOM_SIZE);

$fieldsArr = null;
parse_str($fields, $fieldsArr);

$privileges = array();
$res = new stdClass();

$res->parsedPrivileges = array();
foreach ($fieldsArr as $fieldName => $fieldValue)
{
    if (isset($fieldMapping[$fieldName]))
    {
        $fieldMember = $fieldMapping[$fieldName];
        $res->$fieldMember = $fieldValue;
        continue;
    }
    if (strlen($fieldValue))
    {
        $privileges[] = "{$fieldName}:{$fieldValue}";
        $res->parsedPrivileges[$fieldName] = explode(PRIVILEGES_DELIMITER, $fieldValue);
    }
    else 
    {
        $privileges[] = "{$fieldName}";
        $res->parsedPrivileges[$fieldName] = array();
    }
}

$res->hash = bin2hex($hash);
$res->real_str = $fields;
$res->partner_id = $partnerId;
$res->rand = bin2hex($rand);
$res->privileges = implode(',', $privileges);
if ($res->privileges == 'all:*') {
    $res->privileges = '*';
}

var_dump($res);
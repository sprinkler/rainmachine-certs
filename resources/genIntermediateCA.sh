
#example genWebCert.sh "192.168.1.126"

#rm -rf pki
#mkdir -p pki/newcerts/
#touch pki/index.txt
#echo "`date +%s%w%Y | cut -c 1-12`" > pki/serial

INTERM_CERT_NAME=$1

mkdir intermCA/$INTERM_CERT_NAME
#rm -rf intermCA
#mkdir -p intermCA

echo "********************************************************"
echo "* Setup an intermCA certificate - server side    *"
echo "********************************************************"

#Generate Signing-request-cert
openssl genrsa   -out intermCA/$INTERM_CERT_NAME/interm_rsa_2048.key -f4 2048
openssl req -config openssl_interm.cnf -new  -subj /C=RO/CN=$INTERM_CERT_NAME -days 365 -out new_int.req -key intermCA/$INTERM_CERT_NAME/interm_rsa_2048.key

#Ask the CA to sign
openssl ca -batch -config openssl_interm.cnf -in new_int.req -cert CA_ROOT/rainmachine_root_ca.pem -keyfile CA_ROOT/ca_rsa_2048.key -out intermCA/$INTERM_CERT_NAME/interm_sign_cert.pem
rm new_int.req

#!/bin/bash
CLOUD_CLIENT_NAME=$1
DIRNAME=/home/dragos/rainmachine-certs/resources
mkdir -p $DIRNAME/cloud-client/$CLOUD_CLIENT_NAME

LOCKDIR=$DIRNAME/certreq.lock

echo "********************************************************"
echo "* Setup the cloud-client certificate with DATA=$CLOUD_CLIENT_NAME*"
echo "********************************************************"
echo "********************************************************"
echo "* Generate the PKCS#10 request  	- cloud-client side        *"
echo "********************************************************"
openssl genrsa -out $DIRNAME/cloud-client/$CLOUD_CLIENT_NAME/rsa_2048.key -f4 2048
openssl req -config $DIRNAME/openssl_interm.cnf -new -subj /C=US/CN=$CLOUD_CLIENT_NAME -days 11000 -out $DIRNAME/cloud-client/$CLOUD_CLIENT_NAME/cloud-client_req.req -key $DIRNAME/cloud-client/$CLOUD_CLIENT_NAME/rsa_2048.key
echo "========================================="


echo "***********************************************************"
echo "* generate the certificate from the request - server side *"
echo "***********************************************************"


# Get lock on CA
echo "Locking CA"
while [ 1 ]
do
mkdir "$LOCKDIR"
if [ $? -ne 0 ] ; then
    sleep 1
else
    break
fi
done



# while [ ! mkdir $LOCKDIR &>/dev/null ]; do sleep 1; done
trap 'rm -rf "${LOCKDIR}"' 0
trap 'exit 1' 1 2 3 15

openssl ca -batch -config $DIRNAME/openssl_interm.cnf -in $DIRNAME/cloud-client/$CLOUD_CLIENT_NAME/cloud-client_req.req	-days 11000 -cert $DIRNAME/CA/interm_sign_cert.pem -keyfile $DIRNAME/CA/interm_rsa_2048.key -out $DIRNAME/cloud-client/"$CLOUD_CLIENT_NAME"/cloud-client_cert.pem



echo "========== CA generation complete ========="
rm $DIRNAME/cloud-client/$CLOUD_CLIENT_NAME/cloud-client_req.req


rm -rf sprinkler pki wrong-CA CA sign data.signed data encryption
# rm -rf intermCA

mkdir pki sign CA wrong-CA encryption
#mkdir intermCA

mkdir -p cloud-client

echo -n "100001234567" >pki/serial
touch pki/index.txt
mkdir -p pki/newcerts

echo "********************************************************"
echo "* Create openssl configuration -- minimal             *"
echo "********************************************************"
cat >openssl_root.cnf <<END_OF_CONF


[ ca ]
default_ca	= CA_default		# The default ca section

[ CA_default ]

dir		= pki		# Where everything is kept
certs		= \$dir/certs		# Where the issued certs are kept
crl_dir		= \$dir/crl		# Where the issued crl are kept
database	= \$dir/index.txt	# database index file.
unique_subject	= no			# Set to 'no' to allow creation of	-->IM: uncomment it, otherwise I get segmentation fault error when signing a new request
					# several ctificates with same subject.
new_certs_dir	= \$dir/newcerts		# default place for new certs.

certificate	= \$dir/cacert.pem 	# The CA certificate
serial		= \$dir/serial 		# The current serial number
crlnumber	= \$dir/crlnumber	# the current crl number
					# must be commented out to leave a V1 CRL
crl		= \$dir/crl.pem 		# The current CRL
private_key	= \$dir/private/cakey.pem# The private key
RANDFILE	= \$dir/private/.rand	# private random number file

x509_extensions	= usr_cert		# The extentions to add to the cert

# Comment out the following two lines for the "traditional"
# (and highly broken) format.
name_opt 	= ca_default		# Subject Name options
cert_opt 	= ca_default		# Certificate field options

default_days	= 365			# how long to certify for
default_crl_days= 30			# how long before next CRL
default_md	= default		# use public key default MD
preserve	= no			# keep passed DN ordering

distinguished_name      = req_distinguished_name
# attributes              = req_attributes
policy          = policy_anything

[ req_distinguished_name ]

[ req ]
distinguished_name      = req_distinguished_name

[ policy_anything ]
countryName             = optional
stateOrProvinceName     = optional
localityName            = optional
organizationName        = optional
organizationalUnitName = optional
commonName              = supplied
emailAddress            = optional

[ usr_cert ]

basicConstraints=CA:FALSE
# nsCertType = client, email, objsign

# This is typical in keyUsage for a client certificate.
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
# PKIX recommendations harmless if included in all certificates.
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer


END_OF_CONF



CA_KEY=CA/interm_rsa_2048.key
CA_PEM=CA/interm_sign_cert.pem
ENCRYPT_KEY=encryption/interm_encrypt_rsa_2048.key
ENCRYPT_PEM=encryption/interm_encrypt_cert.pem

CERT_CN=rainmachine-factory-2
SERVER_PREFIX=A

echo -n "$SERVER_PREFIX" > sprinklerIDPrefix.txt

#Generate CA cert:
echo "********************************************************"
echo "* Setup a certification authority  - rainmachine side          *"
echo "********************************************************"

openssl genrsa   -out $CA_KEY -f4 2048
openssl req -config openssl_root.cnf -new  -x509 -subj /C=US/O=rainmachine/CN=$CERT_CN -days 11000 -out $CA_PEM -key $CA_KEY

echo "********************************************************"
echo "* Setup a signing entity   - rainmachine side                  *"
echo "********************************************************"

#Generate Signing-cert
#openssl genrsa   -out sign/rainmachine_sig_rsa_2048.key -f4 2048
#openssl req -config openssl_root.cnf -new  -subj /C=RO/O=rainmachine/CN=rainmachine-sign -days 365 -out new.req -key sign/rainmachine_sig_rsa_2048.key

#Ask the CA to sign CA req
#openssl ca -batch -config openssl_root.cnf -in new.req -cert CA/rainmachine_root_ca.pem -keyfile CA/ca_rsa_2048.key -out sign/rainmachine_sign_cert.pem
#rm new.req

# rainmachine will use two certificates/ private key: one for signing (rainmachine_sign_cert.pem) and one for encryption(enc_cert.pem)
echo "********************************************************"
echo "* Setup the Encryption key certificate	             *"
echo "********************************************************"
echo "********************************************************"
echo "* Generate the PKCS#10 request  	- rainmachine side           *"
echo "********************************************************"
openssl genrsa -out $ENCRYPT_KEY -f4 2048
openssl req -config openssl_root.cnf -new -subj /C=US/O=rainmachine/CN=$CERT_CN-encrypt -days 11000 -out enc_req.req -key $ENCRYPT_KEY

echo "********************************************************"
echo "* generate the certificate from the request - rainmachine side *"
echo "********************************************************"

openssl ca -verbose -batch -config openssl_root.cnf -in enc_req.req -days 11000 -cert $CA_PEM -keyfile $CA_KEY -out $ENCRYPT_PEM
rm enc_req.req


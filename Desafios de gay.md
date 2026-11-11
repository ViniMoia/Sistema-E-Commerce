1 - CARROSSEL HERO

A hero deve ser substituída por um carrossel, ele deve apresentar as artes dos produtos em
destaque e preços.

As imagens serão enviadas pelo dono da loja.

2- IMPLEMENTAR PREÇOS.

Devemos informar os dois valores do produto, cliente solicitou que o valor que deve ficar em
destaque deve ser o valor do produto no cartão enquanto que o valor no pix deve ser
mostrado também, contudo deve ficar em menor destaque.

Devemos tentar encontrar uma maneira de importar esses valores diretamente da SMB
Store.

3 - FRETES:

Devemos reconstruir o sistema de cálculo de fretes. No momento, o sistema analisa se o
produto importado da SMB Store possui cadastrado o peso e as dimensões para que
sistema calcule o frete com base na tabela do correios e da T&J Express, os produto que
não possuem valores de peso e dimensão cadastrados, não possem calculo de frete tendo
a disposição apenas as opçõe de retirada na loja e de combinar com a loja.

Contudo o dono da loja nos informou que para a cidade de Belém e Ananindeua, ele faz a
entrega dos produtos por meio de um entregador local, com esse entregador ele  combinou
o valor por bairros:.

Esta é a tabela com o valor dos fretes para os bairros de Belém e Ananindeua:
Aeroporto
R$ 30,00

Aguas Brancas
R$ 25,00

Aguas Lindas
R$ 25,00

Ananindeua Centro
R$ 20,00

Atalaia
R$ 20,00

Aurá
R$ 30,00

Barreiro
R$ 30,00

Batista Campos
R$ 40,00

Benguí
R$ 25,00

Cabanagem
R$ 20,00

Campina
R$ 35,00

Canudos
R$ 40,00

Castanheira
R$ 20,00

Cidade Nova, Guajara , Paar
R$ 10,00

Cidade Velha
R$ 35,00

Condor
R$ 40,00

Cremação
R$ 40,00

Curió-Utínga
R$ 30,00

Curuçamba
R$ 15,00

Distrito Industrial
R$ 20,00

Fatima
R$ 35,00

Guamá
R$ 40,00

Guanabara
R$ 20,00

Icooraci
R$ 35,00

Icui , 40 Horas
R$ 15,00

Icui Laranjeira
R$ 20,00

Jaderlandia
R$ 20,00

Jiboia Branca
R$ 20,00

Julia Sefer
R$ 25,00

Jurunas
R$ 40,00

Maguari
R$ 15,00

Mangueirão
R$ 20,00

Marambaia
R$ 20,00

Marco
R$ 30,00

Marituba
R$ 30,00

Nazaré
R$ 35,00

Outeiro
R$ 50,00

Parque Verde
R$ 25,00

Pedreira
R$ 30,00

Pratinha
R$ 35,00

Providencia
R$ 15,00

Reduto
R$ 35,00

Sacramenta
R$ 30,00

São Bras
R$ 35,00

Souza
R$ 30,00

Tapanã
R$ 30,00

Telegrafo
R$ 30,00

Tenoné
R$ 30,00

Terra Firme
R$ 40,00

Umarizal
R$ 35,00

Una
R$ 20,00

Val-de-Cães
R$ 30,00

Para produtos mais pesados e maiores, o próprio dono da loja faz a entrega com o seu
próprio veículo, contudo pode demorar até 4 dias para essa entrega acontecer (para
produtos mais pesados).

DESAFIO:

O desafio que encontramos nesta situação é que para locais mais distantes (fora de Belém
e Ananindeua) não é possível ser feita a entrega com base na tabela de preço por bairros.

Uma observação importante nesta etapa é que o dono da loja não quer que seja possivel
nas opções de pagamento o cliente ter que combinar diretamente com ele, ele quer que o
cliente resolva tudo diretamente pela plataforma.

4 - MARCAS

No catálogo existe um carrossel com as marcas que são utilizadas na loja, temos que
apenas trocamos as marcas genéricas pelas marcas reais.

5 - PROPORÇÕES DOS ELEMENTOS:

Temos apenas que tornar os elementos (textos e componentes) maiores para que fique
mais adequado para a visualização dos clientes, em especial os que possuem dificuldade
com visão.

DOMÍNIOS

Temos que trocar o domínio da loja pelo domínio real que será utilizado e que será
comprado pelo dono da loja.

Desafios:

Deve ser alterado o domínio no webhook no Asaas, para que o webhook seja enviado para
o domínio correto.

Deve ser analisado como essa alteração no domínio irá refletir no slug da loja.


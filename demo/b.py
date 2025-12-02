print('b')
import random
if random.random()<0.8:
    with open('c.txt','w') as fid:
        fid.write('aaa')
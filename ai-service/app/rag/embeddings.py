import hashlib, math
DIM=1536

def demo_embedding(text:str)->list[float]:
    # Deterministic local vector so the project runs without downloading a model.
    v=[0.0]*DIM
    words=text.lower().split()
    for i,w in enumerate(words):
        h=int(hashlib.sha256(w.encode()).hexdigest()[:12],16)
        idx=h%DIM; v[idx]+=1.0+((h%100)/100.0)
    norm=math.sqrt(sum(x*x for x in v)) or 1
    return [x/norm for x in v]

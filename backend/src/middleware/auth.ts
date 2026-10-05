import {Request,Response,NextFunction} from 'express';
import jwt from 'jsonwebtoken';
export type Role='student'|'instructor'|'admin';
export interface AuthRequest extends Request {user?:{id:string;role:Role;email:string}}
const secret=()=>process.env.JWT_SECRET||'dev-secret';
export function signAccess(user:any){
    return jwt.sign({id:user.id,sub:user.id,role:user.role,email:user.email},secret(),{expiresIn:'15m'});
}
export function signRefresh(user:any){
    return jwt.sign({id:user.id,sub:user.id,type:'refresh'},process.env.JWT_REFRESH_SECRET||'dev-refresh',{expiresIn:'7d'});
}
export function verifyRefresh(token:string){
    return jwt.verify(token,process.env.JWT_REFRESH_SECRET||'dev-refresh') as any;
}
export function requireAuth(req:AuthRequest,res:Response,next:NextFunction){
    const h=req.headers.authorization;
    if(!h?.startsWith('Bearer '))return res.status(401).json({error:{code:'UNAUTHORIZED',message:'Authentication required'}});
    try{
        const decoded=jwt.verify(h.slice(7),secret()) as any;
        req.user={id:decoded.id||decoded.sub,role:decoded.role,email:decoded.email};
        next();
    }catch{
        return res.status(401).json({error:{code:'TOKEN_EXPIRED',message:'Invalid or expired token'}});
    }
}
export const requireRole=(...roles:Role[])=>(req:AuthRequest,res:Response,next:NextFunction)=>{
    if(!req.user||!roles.includes(req.user.role))return res.status(403).json({error:{code:'FORBIDDEN',message:'Insufficient role'}});
    next();
};

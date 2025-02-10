// src/middlewares/errorHandler.js
module.exports = async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.status = err.status || 500;
    ctx.body = { error: err.message || 'Ocorreu um erro no servidor' };
    ctx.app.emit('error', err, ctx); 
  }
};

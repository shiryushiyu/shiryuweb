const rateLimitMap = new Map();
const blockedIPs = new Set();

function rateLimit(ip, limit = 3, windowMs = 20 * 60 * 1000, timeoutMs = 5 * 60 * 1000) {
  const now = Date.now();
  const key = ip;
  
  if (blockedIPs.has(key)) {
    return {
      allowed: false,
      reason: 'Your IP has been temporarily blocked due to excessive messages.',
      retryAfter: timeoutMs
    };
  }
  
  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, {
      messages: [],
      timeoutUntil: 0,
      totalMessages: 0
    });
  }
  
  const userData = rateLimitMap.get(key);
  
  if (userData.timeoutUntil > now) {
    const remainingSeconds = Math.ceil((userData.timeoutUntil - now) / 1000);
    const remainingMinutes = Math.ceil(remainingSeconds / 60);
    return {
      allowed: false,
      reason: `Too many messages. Please try again in ${remainingMinutes} minute(s).`,
      retryAfter: userData.timeoutUntil - now
    };
  }
  
  userData.messages = userData.messages.filter(timestamp => now - timestamp < windowMs);
  
  if (userData.messages.length >= limit) {
    userData.timeoutUntil = now + timeoutMs;
    userData.totalMessages += 1;
    
    if (userData.totalMessages > 10) {
      blockedIPs.add(key);
      return {
        allowed: false,
        reason: 'Your IP has been blocked due to excessive spam.',
        retryAfter: 24 * 60 * 60 * 1000
      };
    }
    
    return {
      allowed: false,
      reason: `Too many messages. You are timed out for ${timeoutMs / 60000} minutes.`,
      retryAfter: timeoutMs
    };
  }
  
  userData.messages.push(now);
  userData.totalMessages += 1;
  
  setTimeout(() => {
    const data = rateLimitMap.get(key);
    if (data) {
      data.messages = data.messages.filter(timestamp => Date.now() - timestamp < windowMs);
      if (data.messages.length === 0 && data.timeoutUntil <= Date.now()) {
        rateLimitMap.delete(key);
      }
    }
  }, windowMs + timeoutMs);
  
  return {
    allowed: true,
    remainingMessages: limit - userData.messages.length
  };
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return realIp;
  }
  
  if (req.headers['cf-connecting-ip']) {
    return req.headers['cf-connecting-ip'];
  }
  
  return req.socket?.remoteAddress || 'unknown';
}

function clearRateLimit(ip) {
  rateLimitMap.delete(ip);
  blockedIPs.delete(ip);
}

module.exports = { rateLimit, getClientIp, clearRateLimit };
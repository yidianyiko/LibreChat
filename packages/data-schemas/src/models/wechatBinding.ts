import weChatBindingSchema from '~/schema/wechatBinding';
import type { IWeChatBinding } from '~/types';

export function createWeChatBindingModel(mongoose: typeof import('mongoose')) {
  return mongoose.models.WeChatBinding || mongoose.model<IWeChatBinding>('WeChatBinding', weChatBindingSchema);
}

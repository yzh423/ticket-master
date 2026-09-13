# 候票台可靠性与界面更新设计

本轮目标是在不改变官方购票流程的前提下，降低可避免的机会遗漏和误操作。固定场次、人数、预算与可接受票档仍是硬约束；应用不抓取实时库存、操纵排队或自动提交订单。

可靠性分为三处：提醒按当前剩余时间选择一个相关阶段，避免休眠后错过精确一分钟窗口或补发过期提示；本地数据库每次保存维护备份，启动时完整性检查并明确告知回退；订单状态按销售机会分别解释，不因另一机会的失败误导用户继续下单。

首页将销售机会与准备项联系起来。公开销售只提示通用的账号、实名、观演人、付款、渠道、网络、通知核对；优先购、候补和邀请再加入资格核对。若已有待支付或已确认订单，首页优先跳到结果步骤。提示是准备进度，不是预测成功率。

视觉参考 Apple Human Interface Guidelines 的层级、色彩和材质原则：浅色为默认，深色可切换；导航与工具栏使用轻量半透明层，主要内容使用不透明卡片；蓝色只用于关键动作与选中态，成功、警告和错误保留独立语义色。主要操作按钮至少 44px 高，键盘焦点清晰，减少动态效果时停用装饰动画。界面借鉴原则，不复制 Apple 专有控件或品牌视觉。

参考：[Apple Materials](https://developer.apple.com/design/human-interface-guidelines/materials)、[Apple Color](https://developer.apple.com/design/human-interface-guidelines/color)、[Apple Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars)。

验收以单测、Electron UI 流程、数据库损坏恢复、浅/深色截图和安装版启动为依据。真实官方页面能否结账、Android 真机行为、系统通知展示与实际购票概率仍需独立实测。

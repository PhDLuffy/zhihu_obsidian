import {
    App,
    PluginSettingTab,
    Setting,
    Notice,
    ButtonComponent,
    Modal,
    MarkdownRenderer,
    Component,
} from "obsidian";
import ZhihuObPlugin from "./main";
import { loadSettings, saveSettings } from "./settings";
import * as login from "./login_service";
import { loadData, deleteData } from "./data";
import i18n, { type Lang } from "../locales";
import { EditorView } from "@codemirror/view";
import { createCookiesEditor } from "./ui/cookies_editor/editor";

const locale = i18n.current;

export class ZhihuSettingTab extends PluginSettingTab {
    plugin: ZhihuObPlugin;
    isLoggedIn = false;
    cookiesEditor: EditorView;

    hide() {
        this.cookiesEditor?.destroy();
    }

    userInfo: { avatar_url: string; name: string; headline?: string } | null =
        null;

    constructor(app: App, plugin: ZhihuObPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    async display(): Promise<void> {
        const { containerEl } = this;
        containerEl.empty();

        // Check login status
        this.isLoggedIn = await login.checkIsUserLogin(this.app.vault);
        if (this.isLoggedIn) {
            const data = await loadData(this.app.vault);
            this.userInfo = data?.userInfo
                ? {
                      avatar_url: data.userInfo.avatar_url,
                      name: data.userInfo.name,
                      headline: data.userInfo.headline,
                  }
                : null;
        } else {
            this.userInfo = null;
        }

        // User login status and info
        new Setting(containerEl)
            .setName(locale.settings.accountTitle)
            .setDesc(locale.settings.accountTitleDesc)
            .then((setting) => {
                setting.nameEl.addClass("zhihu-flex-container");
                if (this.isLoggedIn && this.userInfo) {
                    const userInfoContainer = setting.nameEl.createDiv({
                        cls: "zhihu-user-info",
                    });

                    userInfoContainer.createEl("img", {
                        cls: "zhihu-avatar",
                        attr: {
                            src: this.userInfo.avatar_url,
                            width: "40",
                            height: "40",
                        },
                    });

                    const textContainer = userInfoContainer.createDiv({
                        cls: "zhihu-text-container",
                    });

                    textContainer.createEl("div", {
                        text: this.userInfo.name,
                        cls: "zhihu-username",
                    });

                    if (this.userInfo.headline) {
                        textContainer.createEl("div", {
                            text: this.userInfo.headline,
                            cls: "zhihu-headline",
                        });
                    }

                    // Log out button
                    setting.addButton((button) =>
                        button
                            .setButtonText(locale.settings.logoutButtonText)
                            .setWarning()
                            .onClick(async () => {
                                try {
                                    // Clear userInfo from zhihu-data.json
                                    await deleteData(
                                        this.app.vault,
                                        "userInfo",
                                    );
                                    this.isLoggedIn = false;
                                    this.userInfo = null;
                                    this.display();
                                } catch (e) {
                                    console.error(locale.error.logoutFailed, e);
                                }
                            }),
                    );
                } else {
                    // Log in button
                    setting.addButton((button) =>
                        button
                            .setButtonText(locale.settings.loginButtonText)
                            .setCta()
                            .onClick(async () => {
                                try {
                                    await login.zhihuWebLogin(this.app);
                                    this.isLoggedIn =
                                        await login.checkIsUserLogin(
                                            this.app.vault,
                                        );
                                    if (this.isLoggedIn) {
                                        const data = await loadData(
                                            this.app.vault,
                                        );
                                        this.userInfo = data?.userInfo
                                            ? {
                                                  avatar_url:
                                                      data.userInfo.avatar_url,
                                                  name: data.userInfo.name,
                                                  headline:
                                                      data.userInfo.headline,
                                              }
                                            : null;
                                    }
                                    this.display();
                                } catch (e) {
                                    console.error(locale.error.loginFailed, e);
                                }
                            }),
                    );
                }
            });

        // User Agent setting
        const settings = await loadSettings(this.app.vault);
        new Setting(containerEl)
            .setName(locale.settings.userAgent)
            .setDesc(locale.settings.userAgentDesc)
            .addText((text) =>
                text
                    .setPlaceholder(locale.settings.userAgentPlaceholder)
                    .setValue(settings.user_agent)
                    .onChange(async (value) => {
                        try {
                            await saveSettings(this.app.vault, {
                                user_agent: value,
                            });
                        } catch (e) {
                            console.error(locale.error.saveUserAgentFailed, e);
                        }
                    }),
            );

        // Restrict @知友 to notes with zhihu tag
        new Setting(containerEl)
            .setName(locale.settings.restrictAt)
            .setDesc(locale.settings.restrictAtDesc)
            .addToggle((toggle) =>
                toggle
                    .setValue(settings.restrictToZhihuFM)
                    .onChange(async (value) => {
                        try {
                            await saveSettings(this.app.vault, {
                                restrictToZhihuFM: value,
                            });
                        } catch (e) {
                            console.error(locale.error.saveRestrictAtFailed, e);
                        }
                    }),
            );

        // Clear Image Cahce in `data.cache`
        new Setting(containerEl)
            .setName(locale.settings.clearImageCache)
            .setDesc(locale.settings.clearImageCacheDesc)
            .then((setting) => {
                // Log out button
                setting.addButton((button) =>
                    button
                        .setButtonText(
                            locale.settings.clearImageCacheButtonText,
                        )
                        .onClick(async () => {
                            try {
                                await deleteData(this.app.vault, "cache");
                                new Notice(locale.notice.imageCacheCleared);
                            } catch (e) {
                                console.error(
                                    locale.error.clearImageCacheFailed,
                                    e,
                                );
                            }
                        }),
                );
            });

        // If send read to Zhihu
        new Setting(containerEl)
            .setName(locale.settings.sendRead)
            .setDesc(locale.settings.sendReadDesc)
            .addToggle((toggle) =>
                toggle
                    .setValue(settings.sendReadToZhihu)
                    .onChange(async (value) => {
                        try {
                            await saveSettings(this.app.vault, {
                                sendReadToZhihu: value,
                            });
                        } catch (e) {
                            console.error(locale.error.saveSendZhihuFailed, e);
                        }
                    }),
            );
        // Setting to enable Zhihu level headings
        new Setting(containerEl)
            .setName(locale.settings.zhihuHeading)
            .setDesc(locale.settings.zhihuHeadingDesc)
            .addToggle((toggle) =>
                toggle
                    .setValue(settings.useZhihuHeadings)
                    .onChange(async (value) => {
                        try {
                            await saveSettings(this.app.vault, {
                                useZhihuHeadings: value,
                            });
                        } catch (e) {
                            console.error(
                                locale.error.saveUseZhihuHeadingFailed,
                                e,
                            );
                        }
                    }),
            );
        // setting to control if set default img name as img base name
        // if img caption is not provided
        new Setting(containerEl)
            .setName(locale.settings.useImgNameDefault)
            .setDesc(locale.settings.useImgNameDefaultDesc)
            .addToggle((toggle) =>
                toggle
                    .setValue(settings.useImgNameDefault)
                    .onChange(async (value) => {
                        try {
                            await saveSettings(this.app.vault, {
                                useImgNameDefault: value,
                            });
                        } catch (e) {
                            console.error(locale.error.saveUseImgNameFailed, e);
                        }
                    }),
            );
        // auto open zhihulink
        new Setting(containerEl)
            .setName(locale.settings.autoOpenZhihuLink)
            .setDesc(locale.settings.autoOpenZhihuLinkDesc)
            .addToggle((toggle) =>
                toggle
                    .setValue(settings.autoOpenZhihuLink)
                    .onChange(async (value) => {
                        try {
                            await saveSettings(this.app.vault, {
                                autoOpenZhihuLink: value,
                            });
                        } catch (e) {
                            console.error("save settings failed:", e);
                        }
                    }),
            );
        // mermaid scale option
        new Setting(containerEl)
            .setName(locale.settings.mermaidScale)
            .setDesc(locale.settings.mermaidScaleDesc)
            .addDropdown((dropdown) => {
                dropdown
                    .addOption("4", locale.settings.UltraHD)
                    .addOption("3", locale.settings.HD)
                    .addOption("2", locale.settings.LR)
                    .setValue(settings.mermaidScale.toString())
                    .onChange(async (value) => {
                        settings.mermaidScale = parseFloat(value);
                        await saveSettings(this.app.vault, {
                            mermaidScale: parseInt(value),
                        });
                    });
            });
        // Add popularize string option
        new Setting(containerEl)
            .setName(locale.settings.addPopularStr)
            .setDesc(locale.settings.addPopularStrDesc)
            .addToggle((toggle) =>
                toggle.setValue(settings.popularize).onChange(async (value) => {
                    if (value) {
                        settings.popularize = true;
                        await saveSettings(this.app.vault, {
                            popularize: value,
                        });
                        return;
                    }
                    // 如果是关闭开关，则显示确认弹窗
                    // 用于跟踪用户是否点击了确认按钮
                    let confirmed = false;

                    const modal = new ConfirmationModal(
                        this.app,
                        locale.settings.closePopularStrWarning,
                        (button) => {
                            button
                                .setButtonText(
                                    locale.settings
                                        .closePopularStrWarningButtonText,
                                )
                                .setWarning();
                        },
                        async () => {
                            confirmed = true; // 标记为已确认
                            settings.popularize = false;
                            await saveSettings(this.app.vault, {
                                popularize: value,
                            });
                        },
                    );

                    modal.onClose = () => {
                        if (!confirmed) {
                            toggle.setValue(true);
                        }
                    };

                    modal.open();
                }),
            );

        // 添加“手动编辑Cookies”开关
        new Setting(containerEl)
            .setName(locale.settings.editCookies)
            .setDesc(locale.settings.editCookiesDesc)
            .addToggle((toggle) =>
                toggle
                    .setValue(settings.manualCookieEdit)
                    .onChange(async (value) => {
                        try {
                            await saveSettings(this.app.vault, {
                                manualCookieEdit: value,
                            });
                            cookiesSetting.settingEl.toggleClass(
                                "cookies-setting-area",
                                value === true,
                            );
                            cookiesSetting.settingEl.toggleClass(
                                "hidden",
                                value !== true,
                            );
                        } catch (e) {
                            console.error("save settings failed:", e);
                        }
                    }),
            );
        // cookies编辑器
        const cookiesSetting = new Setting(containerEl)
            .setName("Cookies")
            .setDesc(locale.settings.editorDesc)
            .setClass(
                settings.manualCookieEdit ? "cookies-setting-area" : "hidden",
            );

        const data = await loadData(this.app.vault);
        createCookiesEditor(this, cookiesSetting, data);
    }
}

export class ConfirmationModal extends Modal {
    constructor(
        app: App,
        bodyMarkdown: string,
        buttonCallback: (button: ButtonComponent) => void,
        clickCallback: () => Promise<void>,
    ) {
        super(app);
        this.contentEl.addClass("zhihu-obsidian-confirmation-modal");
        const contentDiv = this.contentEl.createDiv();
        const component = new (class extends Component {})();

        MarkdownRenderer.render(
            this.app,
            bodyMarkdown,
            contentDiv,
            "", // sourcePath 通常留空
            component, // 将 modal 实例自身作为 Component 传入
        );

        new Setting(this.contentEl)
            .addButton((button) => {
                buttonCallback(button);
                button.onClick(async () => {
                    await clickCallback();
                    this.close();
                });
            })
            .addButton((button) =>
                button
                    .setButtonText(locale.ui.cancel)
                    .onClick(() => this.close()),
            );
    }
}

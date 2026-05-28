import { relations } from "drizzle-orm/relations";
import { aiAgentFlows, aiAgents, profilerAgents, aiPricingRates, aiAgentModels, aiProviders, aiTools, coreRolePermissions, users, planPackages, aiComposioConnections, chats, chatFileReferences, userUploads, chatMessages, chatMessagesDebug, configOnboarding, aiPrompts, configTagNamespaces, configTagCatalog, planPaymentTransactions, coreCreditLedger, coreTokenLedger, creditExchangeRates, userBookmarks, userChatSuggestions, userCustomization, userProfiles, userDashboardLayouts, userDataSources, userFamilyOfficeMembers, userNotes, userProfileSummaries, userReminders, userTierOverrides, userTodos, userWidgetInstances, aiAgentFlowsKnowledgeFiles, aiSystemUploads, aiAgentModelsSupportedTools, chatMessagesAttachments, planPackagesAllowedModels, planPackagesAllowedTools } from "./schema";

export const aiAgentsRelations = relations(aiAgents, ({one, many}) => ({
	aiAgentFlow: one(aiAgentFlows, {
		fields: [aiAgents.currentFlow],
		references: [aiAgentFlows.id],
		relationName: "aiAgents_currentFlow_aiAgentFlows_id"
	}),
	profilerAgent: one(profilerAgents, {
		fields: [aiAgents.profilerAgent],
		references: [profilerAgents.id]
	}),
	aiAgentFlows: many(aiAgentFlows, {
		relationName: "aiAgentFlows_agent_aiAgents_id"
	}),
	chats: many(chats),
	chatMessagesDebugs: many(chatMessagesDebug),
	coreTokenLedgers: many(coreTokenLedger),
	userChatSuggestions: many(userChatSuggestions),
	userNotes: many(userNotes),
}));

export const aiAgentFlowsRelations = relations(aiAgentFlows, ({one, many}) => ({
	aiAgents: many(aiAgents, {
		relationName: "aiAgents_currentFlow_aiAgentFlows_id"
	}),
	aiAgent: one(aiAgents, {
		fields: [aiAgentFlows.agent],
		references: [aiAgents.id],
		relationName: "aiAgentFlows_agent_aiAgents_id"
	}),
	aiAgentFlowsKnowledgeFiles: many(aiAgentFlowsKnowledgeFiles),
}));

export const profilerAgentsRelations = relations(profilerAgents, ({one, many}) => ({
	aiAgents: many(aiAgents),
	aiAgentModel: one(aiAgentModels, {
		fields: [profilerAgents.model],
		references: [aiAgentModels.id]
	}),
}));

export const aiAgentModelsRelations = relations(aiAgentModels, ({one, many}) => ({
	aiPricingRate: one(aiPricingRates, {
		fields: [aiAgentModels.currentPricing],
		references: [aiPricingRates.id]
	}),
	aiProvider: one(aiProviders, {
		fields: [aiAgentModels.provider],
		references: [aiProviders.id]
	}),
	profilerAgents: many(profilerAgents),
	configOnboardings: many(configOnboarding),
	planPackages: many(planPackages),
	aiAgentModelsSupportedTools: many(aiAgentModelsSupportedTools),
	planPackagesAllowedModels: many(planPackagesAllowedModels),
}));

export const aiPricingRatesRelations = relations(aiPricingRates, ({many}) => ({
	aiAgentModels: many(aiAgentModels),
	aiTools: many(aiTools),
	coreCreditLedgers: many(coreCreditLedger),
	coreTokenLedgers: many(coreTokenLedger),
}));

export const aiProvidersRelations = relations(aiProviders, ({many}) => ({
	aiAgentModels: many(aiAgentModels),
	aiTools: many(aiTools),
}));

export const aiToolsRelations = relations(aiTools, ({one, many}) => ({
	aiPricingRate: one(aiPricingRates, {
		fields: [aiTools.currentPricing],
		references: [aiPricingRates.id]
	}),
	aiProvider: one(aiProviders, {
		fields: [aiTools.provider],
		references: [aiProviders.id]
	}),
	aiAgentModelsSupportedTools: many(aiAgentModelsSupportedTools),
	planPackagesAllowedTools: many(planPackagesAllowedTools),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	coreRolePermission: one(coreRolePermissions, {
		fields: [users.role],
		references: [coreRolePermissions.id]
	}),
	planPackage: one(planPackages, {
		fields: [users.plan],
		references: [planPackages.id]
	}),
	aiComposioConnections: many(aiComposioConnections),
	chats: many(chats),
	chatFileReferences: many(chatFileReferences),
	userUploads: many(userUploads),
	chatMessagesDebugs: many(chatMessagesDebug),
	planPaymentTransactions: many(planPaymentTransactions),
	coreCreditLedgers: many(coreCreditLedger),
	coreTokenLedgers: many(coreTokenLedger),
	creditExchangeRates: many(creditExchangeRates),
	userBookmarks: many(userBookmarks),
	userChatSuggestions: many(userChatSuggestions),
	userCustomizations: many(userCustomization),
	userProfiles: many(userProfiles),
	userDashboardLayouts: many(userDashboardLayouts),
	userDataSources: many(userDataSources),
	userFamilyOfficeMembers: many(userFamilyOfficeMembers),
	userNotes: many(userNotes),
	userProfileSummaries: many(userProfileSummaries),
	userReminders: many(userReminders),
	userTierOverrides_grantedBy: many(userTierOverrides, {
		relationName: "userTierOverrides_grantedBy_users_id"
	}),
	userTierOverrides_user: many(userTierOverrides, {
		relationName: "userTierOverrides_user_users_id"
	}),
	userTodos: many(userTodos),
	userWidgetInstances: many(userWidgetInstances),
}));

export const coreRolePermissionsRelations = relations(coreRolePermissions, ({many}) => ({
	users: many(users),
}));

export const planPackagesRelations = relations(planPackages, ({one, many}) => ({
	users: many(users),
	planPaymentTransactions: many(planPaymentTransactions),
	aiAgentModel: one(aiAgentModels, {
		fields: [planPackages.fallbackModel],
		references: [aiAgentModels.id]
	}),
	planPackagesAllowedModels: many(planPackagesAllowedModels),
	planPackagesAllowedTools: many(planPackagesAllowedTools),
}));

export const aiComposioConnectionsRelations = relations(aiComposioConnections, ({one}) => ({
	user: one(users, {
		fields: [aiComposioConnections.user],
		references: [users.id]
	}),
}));

export const chatsRelations = relations(chats, ({one, many}) => ({
	aiAgent: one(aiAgents, {
		fields: [chats.agent],
		references: [aiAgents.id]
	}),
	user: one(users, {
		fields: [chats.user],
		references: [users.id]
	}),
	chatFileReferences: many(chatFileReferences),
	chatMessages: many(chatMessages),
	chatMessagesDebugs: many(chatMessagesDebug),
	coreTokenLedgers: many(coreTokenLedger),
	userNotes: many(userNotes),
}));

export const chatFileReferencesRelations = relations(chatFileReferences, ({one}) => ({
	chat: one(chats, {
		fields: [chatFileReferences.chat],
		references: [chats.id]
	}),
	userUpload: one(userUploads, {
		fields: [chatFileReferences.file],
		references: [userUploads.id]
	}),
	user: one(users, {
		fields: [chatFileReferences.user],
		references: [users.id]
	}),
}));

export const userUploadsRelations = relations(userUploads, ({one, many}) => ({
	chatFileReferences: many(chatFileReferences),
	user: one(users, {
		fields: [userUploads.user],
		references: [users.id]
	}),
	chatMessagesAttachments: many(chatMessagesAttachments),
}));

export const chatMessagesRelations = relations(chatMessages, ({one, many}) => ({
	chat: one(chats, {
		fields: [chatMessages.chat],
		references: [chats.id]
	}),
	chatMessagesDebugs: many(chatMessagesDebug),
	userNotes: many(userNotes),
	chatMessagesAttachments: many(chatMessagesAttachments),
}));

export const chatMessagesDebugRelations = relations(chatMessagesDebug, ({one}) => ({
	aiAgent: one(aiAgents, {
		fields: [chatMessagesDebug.agent],
		references: [aiAgents.id]
	}),
	chat: one(chats, {
		fields: [chatMessagesDebug.chat],
		references: [chats.id]
	}),
	chatMessage: one(chatMessages, {
		fields: [chatMessagesDebug.sourceMessage],
		references: [chatMessages.id]
	}),
	user: one(users, {
		fields: [chatMessagesDebug.user],
		references: [users.id]
	}),
}));

export const configOnboardingRelations = relations(configOnboarding, ({one}) => ({
	aiAgentModel: one(aiAgentModels, {
		fields: [configOnboarding.model],
		references: [aiAgentModels.id]
	}),
	aiPrompt: one(aiPrompts, {
		fields: [configOnboarding.systemPrompt],
		references: [aiPrompts.id]
	}),
}));

export const aiPromptsRelations = relations(aiPrompts, ({many}) => ({
	configOnboardings: many(configOnboarding),
}));

export const configTagCatalogRelations = relations(configTagCatalog, ({one}) => ({
	configTagNamespace: one(configTagNamespaces, {
		fields: [configTagCatalog.namespace],
		references: [configTagNamespaces.id]
	}),
}));

export const configTagNamespacesRelations = relations(configTagNamespaces, ({many}) => ({
	configTagCatalogs: many(configTagCatalog),
}));

export const planPaymentTransactionsRelations = relations(planPaymentTransactions, ({one, many}) => ({
	planPackage: one(planPackages, {
		fields: [planPaymentTransactions.plan],
		references: [planPackages.id]
	}),
	user: one(users, {
		fields: [planPaymentTransactions.user],
		references: [users.id]
	}),
	coreCreditLedgers: many(coreCreditLedger),
}));

export const coreCreditLedgerRelations = relations(coreCreditLedger, ({one}) => ({
	planPaymentTransaction: one(planPaymentTransactions, {
		fields: [coreCreditLedger.paymentTnx],
		references: [planPaymentTransactions.id]
	}),
	coreTokenLedger: one(coreTokenLedger, {
		fields: [coreCreditLedger.tokenEntry],
		references: [coreTokenLedger.id]
	}),
	user: one(users, {
		fields: [coreCreditLedger.user],
		references: [users.id]
	}),
	aiPricingRate: one(aiPricingRates, {
		fields: [coreCreditLedger.pricingRateId],
		references: [aiPricingRates.id]
	}),
}));

export const coreTokenLedgerRelations = relations(coreTokenLedger, ({one, many}) => ({
	coreCreditLedgers: many(coreCreditLedger),
	user: one(users, {
		fields: [coreTokenLedger.user],
		references: [users.id]
	}),
	aiAgent: one(aiAgents, {
		fields: [coreTokenLedger.agent],
		references: [aiAgents.id]
	}),
	aiPricingRate: one(aiPricingRates, {
		fields: [coreTokenLedger.pricingRateId],
		references: [aiPricingRates.id]
	}),
	chat: one(chats, {
		fields: [coreTokenLedger.chat],
		references: [chats.id]
	}),
}));

export const creditExchangeRatesRelations = relations(creditExchangeRates, ({one}) => ({
	user: one(users, {
		fields: [creditExchangeRates.changedBy],
		references: [users.id]
	}),
}));

export const userBookmarksRelations = relations(userBookmarks, ({one}) => ({
	user: one(users, {
		fields: [userBookmarks.user],
		references: [users.id]
	}),
}));

export const userChatSuggestionsRelations = relations(userChatSuggestions, ({one}) => ({
	aiAgent: one(aiAgents, {
		fields: [userChatSuggestions.agent],
		references: [aiAgents.id]
	}),
	user: one(users, {
		fields: [userChatSuggestions.user],
		references: [users.id]
	}),
}));

export const userCustomizationRelations = relations(userCustomization, ({one}) => ({
	user: one(users, {
		fields: [userCustomization.user],
		references: [users.id]
	}),
}));

export const userProfilesRelations = relations(userProfiles, ({one, many}) => ({
	user: one(users, {
		fields: [userProfiles.user],
		references: [users.id]
	}),
	userDashboardLayouts: many(userDashboardLayouts),
}));

export const userDashboardLayoutsRelations = relations(userDashboardLayouts, ({one, many}) => ({
	userProfile: one(userProfiles, {
		fields: [userDashboardLayouts.profile],
		references: [userProfiles.id]
	}),
	user: one(users, {
		fields: [userDashboardLayouts.user],
		references: [users.id]
	}),
	userWidgetInstances: many(userWidgetInstances),
}));

export const userDataSourcesRelations = relations(userDataSources, ({one}) => ({
	user: one(users, {
		fields: [userDataSources.user],
		references: [users.id]
	}),
}));

export const userFamilyOfficeMembersRelations = relations(userFamilyOfficeMembers, ({one}) => ({
	user: one(users, {
		fields: [userFamilyOfficeMembers.user],
		references: [users.id]
	}),
}));

export const userNotesRelations = relations(userNotes, ({one}) => ({
	user: one(users, {
		fields: [userNotes.user],
		references: [users.id]
	}),
	aiAgent: one(aiAgents, {
		fields: [userNotes.agent],
		references: [aiAgents.id]
	}),
	chat: one(chats, {
		fields: [userNotes.chat],
		references: [chats.id]
	}),
	chatMessage: one(chatMessages, {
		fields: [userNotes.sourceMessage],
		references: [chatMessages.id]
	}),
}));

export const userProfileSummariesRelations = relations(userProfileSummaries, ({one}) => ({
	user: one(users, {
		fields: [userProfileSummaries.user],
		references: [users.id]
	}),
}));

export const userRemindersRelations = relations(userReminders, ({one}) => ({
	user: one(users, {
		fields: [userReminders.user],
		references: [users.id]
	}),
}));

export const userTierOverridesRelations = relations(userTierOverrides, ({one}) => ({
	user_grantedBy: one(users, {
		fields: [userTierOverrides.grantedBy],
		references: [users.id],
		relationName: "userTierOverrides_grantedBy_users_id"
	}),
	user_user: one(users, {
		fields: [userTierOverrides.user],
		references: [users.id],
		relationName: "userTierOverrides_user_users_id"
	}),
}));

export const userTodosRelations = relations(userTodos, ({one}) => ({
	user: one(users, {
		fields: [userTodos.user],
		references: [users.id]
	}),
}));

export const userWidgetInstancesRelations = relations(userWidgetInstances, ({one}) => ({
	userDashboardLayout: one(userDashboardLayouts, {
		fields: [userWidgetInstances.dashboard],
		references: [userDashboardLayouts.id]
	}),
	user: one(users, {
		fields: [userWidgetInstances.user],
		references: [users.id]
	}),
}));

export const aiAgentFlowsKnowledgeFilesRelations = relations(aiAgentFlowsKnowledgeFiles, ({one}) => ({
	aiAgentFlow: one(aiAgentFlows, {
		fields: [aiAgentFlowsKnowledgeFiles.sourceId],
		references: [aiAgentFlows.id]
	}),
	aiSystemUpload: one(aiSystemUploads, {
		fields: [aiAgentFlowsKnowledgeFiles.targetId],
		references: [aiSystemUploads.id]
	}),
}));

export const aiSystemUploadsRelations = relations(aiSystemUploads, ({many}) => ({
	aiAgentFlowsKnowledgeFiles: many(aiAgentFlowsKnowledgeFiles),
}));

export const aiAgentModelsSupportedToolsRelations = relations(aiAgentModelsSupportedTools, ({one}) => ({
	aiAgentModel: one(aiAgentModels, {
		fields: [aiAgentModelsSupportedTools.sourceId],
		references: [aiAgentModels.id]
	}),
	aiTool: one(aiTools, {
		fields: [aiAgentModelsSupportedTools.targetId],
		references: [aiTools.id]
	}),
}));

export const chatMessagesAttachmentsRelations = relations(chatMessagesAttachments, ({one}) => ({
	chatMessage: one(chatMessages, {
		fields: [chatMessagesAttachments.sourceId],
		references: [chatMessages.id]
	}),
	userUpload: one(userUploads, {
		fields: [chatMessagesAttachments.targetId],
		references: [userUploads.id]
	}),
}));

export const planPackagesAllowedModelsRelations = relations(planPackagesAllowedModels, ({one}) => ({
	planPackage: one(planPackages, {
		fields: [planPackagesAllowedModels.sourceId],
		references: [planPackages.id]
	}),
	aiAgentModel: one(aiAgentModels, {
		fields: [planPackagesAllowedModels.targetId],
		references: [aiAgentModels.id]
	}),
}));

export const planPackagesAllowedToolsRelations = relations(planPackagesAllowedTools, ({one}) => ({
	planPackage: one(planPackages, {
		fields: [planPackagesAllowedTools.sourceId],
		references: [planPackages.id]
	}),
	aiTool: one(aiTools, {
		fields: [planPackagesAllowedTools.targetId],
		references: [aiTools.id]
	}),
}));
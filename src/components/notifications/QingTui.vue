<template>
    <div class="mb-3">
        <label for="appId" class="form-label">
            App ID
            <span style="color: red"><sup>*</sup></span>
        </label>
        <input id="appId" v-model="$parent.notification.appId" type="text" class="form-control" required />
    </div>
    <div class="mb-3">
        <label for="appSecret" class="form-label">
            App Secret
            <span style="color: red"><sup>*</sup></span>
        </label>
        <HiddenInput id="appSecret" v-model="$parent.notification.appSecret" :required="true"
            autocomplete="new-password"></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="userPhone" class="form-label">
            通知手机号
            <span style="color: red"><sup>*</sup></span>
        </label>
        <input id="userPhone" v-model="$parent.notification.userPhone" type="text" class="form-control" required />
    </div>
</template>

<script lang="ts">
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
};
</script>
